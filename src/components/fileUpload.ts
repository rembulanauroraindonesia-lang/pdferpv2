/**
 * fileUpload() — reusable upload component for mockup file fields.
 * Usage: x-data="fileUpload(doc?.field || '', (v) => doc.field = v)"
 *
 * Features:
 *   - Hidden file input triggered by button clicks
 *   - Image preview (thumbnail + full-view popup)
 *   - PDF icon for non-image files
 *   - Replace ([G]) via dynamic file input
 *   - Clear (×) with log of previous filenames
 *   - Full-view popup for images
 */
export function fileUpload(initial: string, setter: (v: string) => void) {
  return {
    file: initial || "",
    previewUrl: null as string | null,
    log: [] as string[],
    viewerOpen: false,

    get isImage(): boolean {
      if (!this.file) return false;
      const ext = this.file.split(".").pop()?.toLowerCase() || "";
      return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
    },

    handlePick(e: Event) {
      const input = e.target as HTMLInputElement;
      const f = input.files?.[0];
      if (!f) return;
      // Push old filename to log
      if (this.file) this.log.push(this.file);
      const name = f.name;
      this.file = name;
      setter(name);
      // Generate preview for images
      if (f.type.startsWith("image/")) {
        this.previewUrl = URL.createObjectURL(f);
      } else {
        this.previewUrl = null;
      }
      input.value = ""; // allow re-picking same file
    },

    /** Trigger a fresh file picker */
    replace() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,.jpg,.jpeg,.png,image/*,application/pdf";
      input.onchange = (e: Event) => this.handlePick(e);
      input.click();
    },

    /** Clear current file, push to log */
    clearFile() {
      if (this.file) this.log.push(this.file);
      this.file = "";
      this.previewUrl = null;
      setter("");
    },

    get isPDF(): boolean {
      if (!this.file) return false;
      return this.file.toLowerCase().endsWith(".pdf");
    },

    get fileIcon(): string {
      if (this.isImage) return "🖼";
      if (this.isPDF) return "📄";
      return "📎";
    },

    openViewer() {
      // Allow viewer for any file type — images show preview, PDFs show placeholder
      if (this.file) this.viewerOpen = true;
    },
    closeViewer() {
      this.viewerOpen = false;
    },
  };
}
