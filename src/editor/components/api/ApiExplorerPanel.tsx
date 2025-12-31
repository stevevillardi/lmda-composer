import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ApiEndpointCatalog } from './ApiEndpointCatalog';
import { ApiRequestBuilder } from './ApiRequestBuilder';
import { ApiResponseViewer } from './ApiResponseViewer';

export function ApiExplorerPanel() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize="21%" minSize="15%" maxSize="30%">
        <ApiEndpointCatalog />
      </ResizablePanel>

      <ResizableHandle withVerticalHandle />

      <ResizablePanel defaultSize="72%" minSize="40%">
        <ResizablePanelGroup direction="vertical" className="h-full">
          <ResizablePanel defaultSize="58%" minSize="25%">
            <ApiRequestBuilder />
          </ResizablePanel>


          <ResizableHandle withHandle />

          <ResizablePanel defaultSize="42%" minSize="20%">
            <ApiResponseViewer />
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
