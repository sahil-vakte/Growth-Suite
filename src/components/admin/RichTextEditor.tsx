"use client";
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { sanitizeHtml } from "@/lib/site/sanitize";
import MediaPicker from "./MediaPicker";

export default function RichTextEditor({
  id,
  label,
  value,
  readOnly,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  readOnly?: boolean;
  onChange: (html: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pickImage, setPickImage] = useState(false);
  const [image, setImage] = useState<{ url: string; alt: string } | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, defaultProtocol: "https" },
        strike: false,
      }),
      Image.configure({ allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: sanitizeHtml(value),
    editable: !readOnly,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        tabindex: "0",
        class: "rich-text-document",
      },
      transformPastedHTML: sanitizeHtml,
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(value === "" && editor.isEmpty))
      editor.commands.setContent(sanitizeHtml(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);
  if (!editor)
    return (
      <p className="muted" role="status">
        Loading editor...
      </p>
    );
  const button = (name: string, action: () => void, active = false, disabled = false) => (
    <button
      key={name}
      type="button"
      className="btn small"
      aria-label={name}
      aria-pressed={active}
      disabled={readOnly || disabled}
      onClick={action}
    >
      {name}
    </button>
  );
  function applyLink() {
    if (!editor) return;
    if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(url.trim())) {
      setError("Use an https:// address, email, phone number or a /relative path.");
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim(), target: "_blank", rel: "noopener noreferrer" })
      .run();
    setLinkOpen(false);
    setError("");
  }
  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="group" aria-label={`${label} formatting`}>
        <label className="sr-only" htmlFor={`${id}-style`}>
          Text style
        </label>
        <select
          id={`${id}-style`}
          aria-label={`${label} text style`}
          disabled={readOnly}
          value={[2, 3, 4].find((level) => editor.isActive("heading", { level })) || "paragraph"}
          onChange={(e) =>
            e.target.value === "paragraph"
              ? editor.chain().focus().setParagraph().run()
              : editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(e.target.value) as 2 | 3 | 4 })
                  .run()
          }
        >
          <option value="paragraph">Paragraph</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
          <option value="4">Heading 4</option>
        </select>
        {button("Bold", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
        {button(
          "Italic",
          () => editor.chain().focus().toggleItalic().run(),
          editor.isActive("italic"),
        )}
        {button(
          "Underline",
          () => editor.chain().focus().toggleUnderline().run(),
          editor.isActive("underline"),
        )}
        {button(
          "Bullet list",
          () => editor.chain().focus().toggleBulletList().run(),
          editor.isActive("bulletList"),
        )}
        {button(
          "Numbered list",
          () => editor.chain().focus().toggleOrderedList().run(),
          editor.isActive("orderedList"),
        )}
        {button(
          "Quote",
          () => editor.chain().focus().toggleBlockquote().run(),
          editor.isActive("blockquote"),
        )}
        {button(
          "Link",
          () => {
            setUrl(String(editor.getAttributes("link").href || ""));
            setLinkOpen(!linkOpen);
            setError("");
          },
          editor.isActive("link"),
        )}
        {button(
          "Remove link",
          () => editor.chain().focus().unsetLink().run(),
          false,
          !editor.isActive("link"),
        )}
        {button("Image", () => setPickImage(true))}
        {button("Table", () =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        )}
        {button("Undo", () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
        {button("Redo", () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
      </div>
      {editor.isActive("table") && (
        <div className="rich-text-toolbar" role="group" aria-label="Table editing">
          {button("Add row", () => editor.chain().focus().addRowAfter().run())}
          {button("Add column", () => editor.chain().focus().addColumnAfter().run())}
          {button("Delete row", () => editor.chain().focus().deleteRow().run())}
          {button("Delete column", () => editor.chain().focus().deleteColumn().run())}
          {button("Remove table", () => editor.chain().focus().deleteTable().run())}
        </div>
      )}
      {linkOpen && (
        <div className="rich-text-options">
          <label htmlFor={`${id}-link`}>Link address</label>
          <input
            id={`${id}-link`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
          />
          <button type="button" className="btn small" onClick={applyLink}>
            Apply link
          </button>
          <button type="button" className="btn small" onClick={() => setLinkOpen(false)}>
            Cancel link
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
      )}
      {image && (
        <div className="rich-text-options">
          <label htmlFor={`${id}-alt`}>Image description (alt text)</label>
          <input
            id={`${id}-alt`}
            value={image.alt}
            onChange={(e) => setImage({ ...image, alt: e.target.value })}
          />
          <p className="small muted">
            Describe the image for people using a screen reader. Leave blank only for decoration.
          </p>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              editor.chain().focus().setImage({ src: image.url, alt: image.alt }).run();
              setImage(null);
            }}
          >
            Insert image
          </button>
          <button type="button" className="btn small" onClick={() => setImage(null)}>
            Cancel image
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      <p className="rich-text-help">
        Use Ctrl+B for bold, Ctrl+I for italic and Ctrl+Z to undo. Pasted content keeps supported
        formatting; scripts, embedded forms and custom styling are removed.
      </p>
      {pickImage && (
        <MediaPicker
          onClose={() => setPickImage(false)}
          onPick={(m) => {
            setImage(m);
            setPickImage(false);
          }}
        />
      )}
    </div>
  );
}
