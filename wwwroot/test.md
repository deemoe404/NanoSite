# Markdown Test Document

This is a test document to demonstrate various Markdown tags and elements.

---

## Headings

### Level 3 Heading

#### Level 4 Heading

##### Level 5 Heading

---

## Emphasis

*Italic*
**Bold**
***Bold Italic***

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
