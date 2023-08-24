# Markdown Test Document

Markdown, a lightweight markup language, revolutionizes content creation with its concise formatting syntax. By focusing on substance over style, Markdown enables seamless communication of ideas. Document creation becomes effortless through its plain text format, which seamlessly integrates with HTML. Export options include HTML, PDF, and its native .md format.

Markdown's prevalence on platforms like Github, Wikipedia, and Jianshu speaks to its efficiency and simplicity. Fear not the terms "markup" or "language"—Markdown's syntax comprises fewer than a dozen common symbols. Mastery requires mere minutes, empowering you to elegantly capture thoughts and maintain focus without being ensnared by formatting complexities.

With fewer than ten symbols, Markdown offers an immersive writing experience. Liberated from formatting concerns, you attain the sublime state of "tranquil minds, words flowing." In just half an hour, embrace Markdown's elegance and amplify your content creation journey.

---

## Title

In Markdown, you can create headings by adding hash `#` symbols before words or phrases. The number of `#` symbols indicates the level of the heading.

|           Markdown          |             HTML             |         Preview        |
| --------------------------- | ---------------------------- | ---------------------- |
| `# Heading level 1`         | `<h1>Heading level 1</h1>`   | # Heading level 1      |
| `## Heading level 2`        | `<h2>Heading level 2</h2>`   | ## Heading level 2     |
| `### Heading level 3`       | `<h3>Heading level 3</h3>`   | ### Heading level 3    |
| `#### Heading level 4`      | `<h4>Heading level 4</h4>`   | #### Heading level 4   |
| `##### Heading level 5`     | `<h5>Heading level 5</h5>`   | ##### Heading level 5  |
| `###### Heading level 6`    | `<h6>Heading level 6</h6>`   | ###### Heading level 6 |

> Note: there must be a space after hash `#` symbols.
> | 👍 Do this | 😭 Don't do this |
> | ---------- | --------------- |
> | `# Head`   | `#Head`         |

---

## Paragraph

To create paragraphs, please use a blank line to separate a single line or multiple lines of text.

Markdown:

```Markdown
I really like using Markdown.

I think I'll use it to format all of my documents from now on.
```

Preview:

I really like using Markdown.

I think I'll use it to format all of my documents from now on.

> Note: do not indent paragraphs with spaces or tabs.
> |              👍 Do this              |                     😭 Don't do this                    |
> | ------------------------------------ | ------------------------------------------------------ |
> | `Keep lines left-aligned like this.` | `····Don't add tabs or spaces in front of paragraphs.` |

---

## Emphasis

Markdown uses the asterisk `*` symbol to emphasize text, allowing you to create bold, italic, and bold-italic text styles.

|           Markdown           |                        HTML                        |           Preview          |
| ---------------------------- | -------------------------------------------------- | -------------------------- |
| `**Bold Text**`              | `<strong>Bold Text</strong>`                       | **Bold Text**              |
| `*Italic Text*`              | `<em>Italic Text</em>`                             | *Italic Text*              |
| `***Bold and Italic Text***` | `<strong><em>Bold and Italic Text</em></strong>`   | ***Bold and Italic Text*** |
| `~~Strikethrough Text~~`     | `<del>Strikethrough Text</del>`                    | ~~Strikethrough Text~~     |

---

## Quotation

To create a block quote, add a `>` symbol before the paragraph.

Markdown:

```Markdown
> Dorothy followed her through many of the beautiful rooms in her castle.
```

Preview:

> Dorothy followed her through many of the beautiful rooms in her castle.

### Block quotations with multiple paragraphs

Block quotations can include multiple paragraphs. Add a `>` symbol for the blank line between paragraphs.

Markdown:

```Markdown
> Dorothy followed her through many of the beautiful rooms in her castle.
>
> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.
```

Preview:

> Dorothy followed her through many of the beautiful rooms in her castle.
>
> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.

### Nested block quotations

Block quotations can be nested. Add a `>>` symbol before the paragraph you want to nest.

Markdown:

```Markdown
> Dorothy followed her through many of the beautiful rooms in her castle.
>
>> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.
```

Preview:

> Dorothy followed her through many of the beautiful rooms in her castle.
>
>> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.

### Block quotations with other elements

Block quotes can contain other Markdown-formatted elements. Not all elements are usable, and you'll need to experiment to see which ones work.

Markdown:

```Markdown
> #### The quarterly results look great!
>
> - Revenue was off the chart.
> - Profits were higher than ever.
>
> *Everything* is going according to **plan**.
```

Preview:

> #### The quarterly results look great!
>
> - Revenue was off the chart.
> - Profits were higher than ever.
>
> *Everything* is going according to **plan**.

---

## Lists

### Unordered List

- Item 1
- Item 2
  - Subitem 1
  - Subitem 2

### Ordered List

1. First item
2. Second item
   1. Subitem A
   2. Subitem B

---

## Code

To represent a word or phrase as code, enclose it with backticks (\`).

### Inline code

Markdown:

```Markdown
`console.log("Hello, World!");`
```

Preview:

`console.log("Hello, World!");`

### Block Code

Markdown:

````Markdown
```C++
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;

    return 0;
}
```
````

Preview:

```C++
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;

    return 0;
}
```

---

## Links

Without title: [Visit Google](https://www.google.com)

With title: [Visit GitHub](https://www.github.com "GitHub")

---

## Images

Without title:

![Markdown Logo](https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/1280px-Markdown-mark.svg.png)

With title:

![Markdown Logo](https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/1280px-Markdown-mark.svg.png "Markdown Logo")

local:

![Markdown Logo](/wwwroot/images/Markdown-mark.svg.png "Markdown Logo")

---

## Tables

| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell A   | Cell B   | Cell C   |
| \|Cell o | Cell 0   | Cell O   |
| *cat*    | **dog**  |***duck***|

---

## Task Lists

- [x] Task 1
- [ ] Task 2
- [ ] Task 3

---

## Comments (Escape Characters)

Markdown:

```Markdown
<!-- This is a comment and won't be displayed -->
```

Preview:

<!-- This is a comment and won't be displayed -->

Markdown:

```Markdown
\\ \* \_ \{ \} \[ \] \( \) \# \+ \- \. \! \|
```

PreView:

\\ \* \_ \{ \} \[ \] \( \) \# \+ \- \. \! \|
