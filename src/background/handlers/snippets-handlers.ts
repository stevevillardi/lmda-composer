/**
 * Handlers for module snippets messages.
 */

import type { HandlerContext, SendResponse } from './types';
import {
  getCache as getModuleSnippetsCache,
  saveSnippets,
  getCachedSource,
  saveSource,
  clearCache as clearModuleSnippetsCache,
  parseSnippetResponse,
} from '../module-snippets-cache';

export async function handleGetModuleSnippetsCache(
  _payload: undefined,
  sendResponse: SendResponse,
  _context: HandlerContext
) {
  try {
    const cache = await getModuleSnippetsCache();
    sendResponse({ type: 'MODULE_SNIPPETS_CACHE', payload: cache });
  } catch (error) {
    sendResponse({
      type: 'MODULE_SNIPPETS_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to get module snippets cache',
        code: 500,
      },
    });
  }
}

export async function handleClearModuleSnippetsCache(
  _payload: undefined,
  sendResponse: SendResponse,
  _context: HandlerContext
) {
  try {
    await clearModuleSnippetsCache();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      type: 'MODULE_SNIPPETS_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to clear module snippets cache',
        code: 500,
      },
    });
  }
}

export async function handleFetchModuleSnippets(
  payload: { portalId: string; collectorId: number },
  sendResponse: SendResponse,
  { portalManager, scriptExecutor }: HandlerContext
) {
  const { portalId, collectorId } = payload;
  try {
    const portal = portalManager.getPortal(portalId);
    if (!portal) {
      sendResponse({
        type: 'MODULE_SNIPPETS_ERROR',
        payload: { error: 'Portal not found', code: 404 },
      });
      return;
    }

    // Execute Groovy script to fetch snippets from collector
    const groovyScript = `
import groovy.xml.*
import groovy.util.*
import groovy.json.*
import com.santaba.agent.util.Settings
import com.santaba.agent.http.AgentHttpService
import java.util.zip.GZIPInputStream

def ahs = new AgentHttpService(Settings.getProperties())
def con = ahs.getMedia("/santaba/api/getStoredScripts")

// Handle potential gzip encoding
def response
if (con.getContentEncoding() == "gzip") {
    response = new GZIPInputStream(con.getInputStream()).getText()
} else {
    response = con.getInputStream().getText()
}

def feed = new XmlSlurper().parseText(response)

def snippets = []
feed.scripts.children().findAll { it.status.text() == "active" }.each { script ->
    snippets << [
        name: script.name.text(),
        version: script.version.text(),
        language: script.language.text(),
        description: script.description.text()?.take(200) ?: ""
    ]
}

println JsonOutput.toJson(snippets)
return 0
`;

    const executionId = crypto.randomUUID();
    const result = await scriptExecutor.execute({
      portalId,
      collectorId,
      script: groovyScript,
      language: 'groovy',
      mode: 'freeform',
      executionId,
    });

    if (result.status === 'error' || result.error) {
      sendResponse({
        type: 'MODULE_SNIPPETS_ERROR',
        payload: { error: result.error || 'Failed to fetch module snippets', code: 500 },
      });
      return;
    }

    // Parse the JSON output from the script
    // The output format is: "returns 0\noutput:\n[...JSON...]"
    // We need to extract just the JSON array
    const rawOutput = result.rawOutput.trim();
    let rawSnippets: Array<{ name: string; version: string; language: string; description?: string }>;
    
    try {
      // Find the JSON array in the output (starts with '[')
      const jsonStart = rawOutput.indexOf('[');
      const jsonEnd = rawOutput.lastIndexOf(']');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON array found in output');
      }
      
      const jsonString = rawOutput.substring(jsonStart, jsonEnd + 1);
      rawSnippets = JSON.parse(jsonString);
    } catch (parseError) {
      sendResponse({
        type: 'MODULE_SNIPPETS_ERROR',
        payload: { error: `Failed to parse module snippets response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`, code: 500 },
      });
      return;
    }

    // Process and group snippets
    const snippets = parseSnippetResponse(rawSnippets);

    // Get collector description for meta
    const collectors = await portalManager.getCollectors(portalId);
    const collector = collectors.find(c => c.id === collectorId);
    const collectorDescription = collector?.description || `Collector #${collectorId}`;

    // Save to cache
    const meta = {
      fetchedAt: Date.now(),
      fetchedFromPortal: portal.hostname,
      fetchedFromCollector: collectorId,
      collectorDescription,
    };
    await saveSnippets(snippets, meta);

    sendResponse({
      type: 'MODULE_SNIPPETS_FETCHED',
      payload: { snippets, meta },
    });
  } catch (error) {
    sendResponse({
      type: 'MODULE_SNIPPETS_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to fetch module snippets',
        code: 500,
      },
    });
  }
}

export async function handleFetchModuleSnippetSource(
  payload: { portalId: string; collectorId: number; name: string; version: string },
  sendResponse: SendResponse,
  { portalManager, scriptExecutor }: HandlerContext
) {
  const { portalId, collectorId, name, version } = payload;

  try {
    // Check cache first
    const cached = await getCachedSource(name, version);
    if (cached) {
      sendResponse({ type: 'MODULE_SNIPPET_SOURCE_FETCHED', payload: cached });
      return;
    }

    const portal = portalManager.getPortal(portalId);
    if (!portal) {
      sendResponse({
        type: 'MODULE_SNIPPETS_ERROR',
        payload: { error: 'Portal not found', code: 404 },
      });
      return;
    }

    // Execute Groovy script to fetch specific snippet source
    const snippetNameEscaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const snippetVersionEscaped = version.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    
    const groovyScript = `
import groovy.xml.*
import groovy.util.*
import com.santaba.agent.util.Settings
import com.santaba.agent.http.AgentHttpService
import java.util.zip.GZIPInputStream

def snippetName = "${snippetNameEscaped}"
def snippetVersion = "${snippetVersionEscaped}"
def language = "groovy"

def ahs = new AgentHttpService(Settings.getProperties())
def encodedName = URLEncoder.encode(snippetName, "UTF-8")
def encodedVersion = URLEncoder.encode(snippetVersion, "UTF-8")
def endpoint = "/santaba/api/getStoredScripts?language=" + language + "&name=" + encodedName + "&version=" + encodedVersion
def con = ahs.getMedia(endpoint)

// Handle potential gzip encoding
def response
if (con.getContentEncoding() == "gzip") {
    response = new GZIPInputStream(con.getInputStream()).getText()
} else {
    response = con.getInputStream().getText()
}

def xml = new XmlSlurper().parseText(response)

xml.scripts.children().each { script ->
    println script.payload.text()
}
return 0
`;

    const executionId = crypto.randomUUID();
    const result = await scriptExecutor.execute({
      portalId,
      collectorId,
      script: groovyScript,
      language: 'groovy',
      mode: 'freeform',
      executionId,
    });

    if (result.status === 'error' || result.error) {
      sendResponse({
        type: 'MODULE_SNIPPETS_ERROR',
        payload: { error: result.error || 'Failed to fetch module snippet source', code: 500 },
      });
      return;
    }

    const source = {
      name,
      version,
      code: result.rawOutput,
      fetchedAt: Date.now(),
    };

    // Cache the source
    await saveSource(source);

    sendResponse({ type: 'MODULE_SNIPPET_SOURCE_FETCHED', payload: source });
  } catch (error) {
    sendResponse({
      type: 'MODULE_SNIPPETS_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Failed to fetch module snippet source',
        code: 500,
      },
    });
  }
}

