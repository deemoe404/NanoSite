## NanoSite Feature Demo

Welcome! This page demonstrates what NanoSite can render using plain Markdown.

## Headings and TOC

This page uses H2/H3 headings so they appear in the sidebar TOC and highlight as you scroll.

### Nested Section

Nested headings are supported and show as indented items in the TOC.

## Links

- Without title: [Visit Google](https://www.google.com)
- With title: [Visit GitHub](https://www.github.com "GitHub Home")
- Internal link to this demo: [Open demo](?id=features-demo.md)

## Emphasis and Inline Code

- Emphasis: *italic*, **bold**, ~~strikethrough~~.
- Inline code: `console.log("Hello, world!")`

## Lists

- Unordered item A
- Unordered item B
  - Nested item B.1

1. Ordered A
2. Ordered B

## To‑do List

- [x] Render Markdown
- [ ] Support images and code
- [x] Show TOC and highlight

## Blockquote

> Markdown is easy to write, easy to read, and easy to publish.

## Code Blocks

```js
export function greet(name) {
  return `Hello, ${name}!`;
}
console.log(greet("NanoSite"));
```

````
This is a raw four‑backtick block.
Markdown inside is not parsed: **no bold**, [no links](#), etc.
````

## Table

| Feature        | Status   | Notes             |
| -------------- | -------- | ----------------- |
| Headings/TOC   | Ready    | H2/H3 in TOC      |
| Links/Emphasis | Ready    | Title attribute   |
| Code Blocks    | Ready    | Fenced + raw      |
| Images         | Ready    | Relative/remote   |
| To‑do List     | Ready    | Disabled checkboxes|

## Images

Relative image from repo (wwwroot/images/…):

![Markdown Logo](images/Markdown-mark.svg.png "Local SVG")

Remote image (still supported):

![Remote Logo](https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/256px-Markdown-mark.svg.png "Remote SVG")

## Long URLs and Wrapping

Very long URL text wraps inside the content area:

https://example.com/this/is/a/very/long/url/that/should/wrap/in/the/content/column/to/avoid/horizontal/scrolling/and/layouthift

## Final Notes

- This page uses only Markdown and local assets.
- Edit or add posts in `wwwroot/`, then update `wwwroot/index.json`.
