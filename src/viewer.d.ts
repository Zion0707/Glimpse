interface ImageFile {
    name: string;
    path: string;
    url: string;
    size: number;
    modified: number;
}

interface ImageCollection {
    files: ImageFile[];
    selected: number;
    folder: string;
}

interface ViewerAPI {
    open(folder: boolean): Promise<ImageCollection | null>;
    drop(file: File): Promise<ImageCollection>;
    fullscreen(): Promise<boolean>;
    trash(file: string): Promise<void>;
    rename(file: string, name: string): Promise<ImageFile>;
    refresh(): Promise<ImageCollection | null>;
    closeChoice(choice: 'tray' | 'quit' | 'cancel'): Promise<void>;
    onClose(callback: () => void): void;
    onOpen(callback: (data: ImageCollection) => void): void;
    onFolderChanged(callback: () => void): void;
}

interface Window {
    viewer?: ViewerAPI;
}
