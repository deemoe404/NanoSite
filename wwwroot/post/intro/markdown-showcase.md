# Markdown Showcase

This page demonstrates the Markdown features supported by NanoSite’s client-side renderer.

> Tip: Use the TOC on the right to jump between sections.

## Headings

### H3 Heading

Regular paragraph text with some inline styles like **bold**, *italic*, and `inline code`.

## Lists

- Unordered item A
- Unordered item B
  - Nested item (supported as plain text)

1. Ordered one
2. Ordered two
3. Ordered three

## Task List

- [x] Set up the repo
- [x] Add a new post
- [ ] Ship it to GitHub Pages

## Links

- External link: https://example.com
- In-site link: [Back to About This Project](?id=post/intro/about-this-project.md)

## Images

Local image from `post/intro/1.png`:

![Markdown logo](1.png)

## Code Blocks

```js
// JavaScript example
function greet(name) {
  return `Hello, ${name}!`;
}
console.log(greet('NanoSite'));
```

```bash
# Shell example
python3 -m http.server 8000
```

## Blockquote

> Blogging should be simple. Write Markdown, commit, done.

## Horizontal Rule

---

## Table

| Feature       | Supported | Notes                         |
| ------------- | :-------: | ----------------------------- |
| Headings      |    ✅     | H1–H3 generate TOC entries    |
| Bold/Italic   |    ✅     |                               |
| Code fences   |    ✅     | `js`, `bash`, plain           |
| Lists         |    ✅     | Ordered/Unordered             |
| Task lists    |    ✅     | Checkbox styling included     |
| Images        |    ✅     | Local or remote               |
| Tables        |    ✅     | Wrapped for horizontal scroll |

## Deep Link Target

You can link to any section using its generated anchor.

Return to the intro: [About This Project](?id=post/intro/about-this-project.md)
