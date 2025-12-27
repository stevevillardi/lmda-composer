import { 
  FolderOpen, 
  Download,
  FileInput,
  Settings,
  MoreHorizontal,
  PanelRight,
} from 'lucide-react';
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
    rightSidebarOpen,
    toggleRightSidebar,
    openFileFromDisk,
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
                  <MoreHorizontal className="size-4" />
                  <span className="hidden sm:inline text-xs">Actions</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Actions Menu</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={openFileFromDisk}>
          <FileInput className="size-4 mr-2" />
          <span className="flex-1">Open File...</span>
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => setModuleBrowserOpen(true)}
          disabled={!selectedPortalId}
        >
          <FolderOpen className="size-4 mr-2" />
          <span className="flex-1">Open from LMX Exchange</span>
          <Kbd className="ml-auto">⌘O</Kbd>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={exportToFile}>
          <Download className="size-4 mr-2" />
          <span className="flex-1">Export to File</span>
          <Kbd className="ml-auto">⌘S</Kbd>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={toggleRightSidebar}>
          <PanelRight className="size-4 mr-2" />
          <span className="flex-1">{rightSidebarOpen ? 'Hide' : 'Show'} Sidebar</span>
          <Kbd className="ml-auto">⌘B</Kbd>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setSettingsDialogOpen(true)}>
          <Settings className="size-4 mr-2" />
          <span className="flex-1">Settings</span>
          <Kbd className="ml-auto">⌘,</Kbd>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

