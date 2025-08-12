# Markdown Test Document

Markdown simplifies content creation with concise formatting. It's efficient on platforms like Github and Wikipedia. Despite being a markup language, its syntax uses few symbols. Master Markdown in minutes for focused, elegant content creation.

---

## Title

In Markdown, you can create headings by adding hash `#` symbols before words or phrases. The number of `#` symbols indicates the level of the heading.

| Markdown                 | HTML                       | Preview                |
| ------------------------ | -------------------------- | ---------------------- |
| `# Heading level 1`      | `<h1>Heading level 1</h1>` | # Heading level 1      |
| `## Heading level 2`     | `<h2>Heading level 2</h2>` | ## Heading level 2     |
| `### Heading level 3`    | `<h3>Heading level 3</h3>` | ### Heading level 3    |
| `#### Heading level 4`   | `<h4>Heading level 4</h4>` | #### Heading level 4   |
| `##### Heading level 5`  | `<h5>Heading level 5</h5>` | ##### Heading level 5  |
| `###### Heading level 6` | `<h6>Heading level 6</h6>` | ###### Heading level 6 |

> Note: there must be a space after hash `#` symbols.
> | 👍 Do this | 😭 Don't do this |
> | ---------- | --------------- |
> | `# Head`   | `#Head`         |

---

## Paragraph

To create paragraphs, please use a blank line to separate a single line or multiple lines of text.

📝 Markdown:

```Markdown
I really like using Markdown.

I think I'll use it to format all of my documents from now on.
```

👀 Preview:

I really like using Markdown.

I think I'll use it to format all of my documents from now on.

> Note: do not indent paragraphs with spaces or tabs.
> |              👍 Do this              |                     😭 Don't do this                    |
> | ------------------------------------ | ------------------------------------------------------ |
> | `Keep lines left-aligned like this.` | `····Don't add tabs or spaces in front of paragraphs.` |

---

## Emphasis

Markdown uses the asterisk `*` symbol to emphasize text, allowing you to create bold, italic, and bold-italic text styles.

| Markdown                     | HTML                                             | Preview                    |
| ---------------------------- | ------------------------------------------------ | -------------------------- |
| `**Bold Text**`              | `<strong>Bold Text</strong>`                     | **Bold Text**              |
| `*Italic Text*`              | `<em>Italic Text</em>`                           | *Italic Text*              |
| `***Bold and Italic Text***` | `<strong><em>Bold and Italic Text</em></strong>` | ***Bold and Italic Text*** |
| `~~Strikethrough Text~~`     | `<del>Strikethrough Text</del>`                  | ~~Strikethrough Text~~     |

---

## Quotation

To create a block quote, add a `>` symbol before the paragraph.

📝 Markdown:

```Markdown
> Dorothy followed her through many of the beautiful rooms in her castle.
```

👀 Preview:

> Dorothy followed her through many of the beautiful rooms in her castle.

### Block quotations with multiple paragraphs

Block quotations can include multiple paragraphs. Add a `>` symbol for the blank line between paragraphs.

📝 Markdown:

```Markdown
> Dorothy followed her through many of the beautiful rooms in her castle.
>
> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.
```

👀 Preview:

> Dorothy followed her through many of the beautiful rooms in her castle.
>
> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.

### Nested block quotations

Block quotations can be nested. Add a `>>` symbol before the paragraph you want to nest.

📝 Markdown:

```Markdown
> Dorothy followed her through many of the beautiful rooms in her castle.
>
>> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.
```

👀 Preview:

> Dorothy followed her through many of the beautiful rooms in her castle.
>
>> The Witch bade her clean the pots and kettles and sweep the floor and keep the fire fed with wood.

### Block quotations with other elements

Block quotes can contain other Markdown-formatted elements. Not all elements are usable, and you'll need to experiment to see which ones work.

📝 Markdown:

```Markdown
> #### The quarterly results look great!
>
> - Revenue was off the chart.
> - Profits were higher than ever.
>
> *Everything* is going according to **plan**.
```

👀 Preview:

> #### The quarterly results look great
>
> - Revenue was off the chart.
> - Profits were higher than ever.
>
> *Everything* is going according to **plan**.

---

## Lists

Lists is not supported.

---

## Code

To represent a word or phrase as code, enclose it with backticks (\`).

### Inline code

📝 Markdown:

```Markdown
`console.log("Hello, World!");`
```

👀 Preview:

`console.log("Hello, World!");`

### Block Code

📝 Markdown:

````Markdown
```C++
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;

    return 0;
}
```
````

👀 Preview:

```C++
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;

    return 0;
}
```

---

## Links

📝 Markdown:

```Markdown
Without title: [Visit Google](https://www.google.com)

With title: [Visit GitHub](https://www.github.com "GitHub")
```

👀 Preview:

Without title: [Visit Google](https://www.google.com)

With title: [Visit GitHub](https://www.github.com "GitHub")

> Note: The quotation mark at the end of the parentheses is not mandatory, it controls the text displayed when hovering the mouse over the link.

---

## Images

To add an image, please use an exclamation mark `!`, followed by square brackets for alternative text. Place the image link within parentheses. After the parentheses, you can optionally add a caption for the image.

📝 Markdown:

```Markdown
![Markdown LOGO](https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Markdown-mark.svg/1280px-Markdown-mark.svg.png "Markdown LOGO")
```

👀 Preview:

![Markdown LOGO](images/Markdown-mark.svg.png "Markdown LOGO")

> Note: The quotation mark at the end of the parentheses is not mandatory, it controls the text displayed when hovering the mouse over the image.

---

## Tables

```Markdown
| Header 1 | Header 2 | Header 3   |
| -------- | -------- | ---------- |
| Cell 1   | Cell 2   | Cell 3     |
| Cell A   | Cell B   | Cell C     |
| Cell o   | Cell 0   | Cell O     |
| *cat*    | **dog**  | ***duck*** |
```

| Header 1 | Header 2 | Header 3   |
| -------- | -------- | ---------- |
| Cell 1   | Cell 2   | Cell 3     |
| Cell A   | Cell B   | Cell C     |
| Cell o   | Cell 0   | Cell O     |
| *cat*    | **dog**  | ***duck*** |

---

## Task Lists

```Markdown
- [x] Task 1 is Completed!
- [ ] Task 2 is pending...
- [ ] Task 3 is pending too...
```

- [x] Task 1 is Completed!
- [ ] Task 2 is pending...
- [ ] Task 3 is pending too...

---

## Annotations & Escape Characters

**Annotations** are elements that appear in Markdown files but are not displayed on the webpage.

📝 Markdown:

```Markdown
<!-- This is a comment and won't be displayed -->
```

👀 Preview:

<!-- This is a comment and won't be displayed -->

> You Can't See anything😶‍🌫️, but it's there!

**Escape Characters** are a way to display special Markdown characters on a webpage.

📝 Markdown:

```Markdown
\\ \* \_ \{ \} \[ \] \( \) \# \+ \- \. \! \| \`

\*This is non-italic text enclosed by italic symbols.\*
```

👀 Preview:

\\ \* \_ \{ \} \[ \] \( \) \# \+ \- \. \! \| \`

\*This is non-italic text enclosed by italic symbols.\*
