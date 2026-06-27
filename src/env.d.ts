/// <reference path="../.astro/types.d.ts" />

type FileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
};

type FileSystemFileEntry = FileSystemEntry & {
  isFile: true;
  isDirectory: false;
  file: (callback: (file: File) => void) => void;
};

type FileSystemDirectoryReader = {
  readEntries: (callback: (entries: FileSystemEntry[]) => void) => void;
};

type FileSystemDirectoryEntry = FileSystemEntry & {
  isFile: false;
  isDirectory: true;
  createReader: () => FileSystemDirectoryReader;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

declare namespace astroHTML.JSX {
  interface InputHTMLAttributes {
    webkitdirectory?: boolean | '';
    directory?: boolean | '';
  }
}
