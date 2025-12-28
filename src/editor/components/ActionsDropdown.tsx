import {  
  Download,
  FileInput,
  Save,
  Settings,
  CommandIcon,
  PanelRight,
  CloudDownload,
  Hammer,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../stores/editor-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';

export function ActionsDropdown() {
  const {
    selectedPortalId,
    setModuleBrowserOpen,
    setSettingsDialogOpen,
    setAppliesToTesterOpen,
    rightSidebarOpen,
    toggleRightSidebar,
    openFileFromDisk,
    saveFile,
    saveFileAs,
    exportToFile,
  } = useEditorStore();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                >
                  <CommandIcon className="size-4" />
                  <span className="hidden sm:inline text-xs">Actions</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Actions Menu</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => {
          openFileFromDisk();
          toast.info('Opening file...');
        }}>
          <FileInput className="size-4 mr-2" />
          <span className="flex-1">Open File...</span>
          <Kbd className="ml-auto">⌘O</Kbd>
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => {
            setModuleBrowserOpen(true);
            toast.info('Opening LogicModule Exchange...');
          }}
          disabled={!selectedPortalId}
        >
          <CloudDownload className="size-4 mr-2" />
          <span className="flex-1">Import from LogicModule Exchange</span>
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => {
            setAppliesToTesterOpen(true);
            toast.info('Opening AppliesTo Toolbox...');
          }}
          disabled={!selectedPortalId}
        >
          <Hammer className="size-4 mr-2" />
          <span className="flex-1">AppliesTo Toolbox</span>
          <Kbd className="ml-auto">⌘⇧A</Kbd>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={async () => {
          try {
            await saveFile();
            toast.success('File saved');
          } catch (error) {
            toast.error('Failed to save file', {
              description: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }}>
          <Save className="size-4 mr-2" />
          <span className="flex-1">Save</span>
          <Kbd className="ml-auto">⌘S</Kbd>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={async () => {
          try {
            await saveFileAs();
            toast.success('File saved');
          } catch (error) {
            toast.error('Failed to save file', {
              description: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }}>
          <Download className="size-4 mr-2" />
          <span className="flex-1">Save As...</span>
          <Kbd className="ml-auto">⌘⇧S</Kbd>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => {
          exportToFile();
          toast.success('File exported', {
            description: 'Download started',
          });
        }}>
          <Download className="size-4 mr-2" />
          <span className="flex-1">Export (Download)</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => {
          toggleRightSidebar();
          toast.info(rightSidebarOpen ? 'Sidebar hidden' : 'Sidebar shown');
        }}>
          <PanelRight className="size-4 mr-2" />
          <span className="flex-1">{rightSidebarOpen ? 'Hide' : 'Show'} Sidebar</span>
          <Kbd className="ml-auto">⌘B</Kbd>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => {
          setSettingsDialogOpen(true);
          toast.info('Opening settings...');
        }}>
          <Settings className="size-4 mr-2" />
          <span className="flex-1">Settings</span>
          <Kbd className="ml-auto">⌘,</Kbd>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

