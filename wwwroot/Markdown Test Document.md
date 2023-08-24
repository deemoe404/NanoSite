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

## Blockquotes

> This is a blockquote.
> It can span multiple lines.
> > This is a blockquote.
> > It can span multiple lines.
> > > This is a blockquote.
> > > It can span multiple lines.
> 1. list1
> 2. list2
> - list3
> - list4

---

## Code

Inline code: `console.log("Hello, World!");`

block:

``` C++
#include <iostream>
#include <vector>
#include <cmath>

// Structure to store the coefficients of the sin function
struct SinCoefficients {
    double amplitude;
    double frequency;
    double phase;
    double offset;
};

// Function to fit sin function to data
SinCoefficients fitSinFunction(const std::vector<double>& time, const std::vector<double>& values) {
    const int n = time.size();
    double sum_x = 0.0, sum_y = 0.0, sum_xy = 0.0, sum_x2 = 0.0;
    
    for (int i = 0; i < n; ++i) {
        sum_x += time[i];
        sum_y += values[i];
        sum_xy += time[i] * values[i];
        sum_x2 += time[i] * time[i];
    }

    double mean_x = sum_x / n;
    double mean_y = sum_y / n;
    double mean_xy = sum_xy / n;
    double mean_x2 = sum_x2 / n;

    double frequency = 1.0 / (2.0 * M_PI) * std::sqrt(std::abs(n * mean_x2 - sum_x * sum_x));
    double amplitude = 2.0 * std::sqrt(std::abs(n * mean_y * mean_y - sum_y * sum_y)) / n;
    double phase = std::atan2(sum_y, sum_x);

    double offset = mean_y - amplitude * std::sin(phase);

    SinCoefficients coefficients;
    coefficients.amplitude = amplitude;
    coefficients.frequency = frequency;
    coefficients.phase = phase;
    coefficients.offset = offset;

    return coefficients;
}

int main() {
    // Example data (replace these arrays with your own data)
    std::vector<double> time = {0.0, 1.0, 2.0, 3.0, 4.0, 5.0};
    std::vector<double> values = {0.0, 0.866, 1.0, 0.866, 0.0, -0.866};

    SinCoefficients coefficients = fitSinFunction(time, values);

    std::cout << "Amplitude: " << coefficients.amplitude << std::endl;
    std::cout << "Frequency: " << coefficients.frequency << std::endl;
    std::cout << "Phase: " << coefficients.phase << std::endl;
    std::cout << "Offset: " << coefficients.offset << std::endl;

    return 0;
}

```

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

## Strikethrough

~~This is strikethrough text.~~

---

## Escape Characters

\*This text won't be italicized\*

---

## Comments

<!-- This is a comment and won't be displayed -->
