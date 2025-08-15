# SEO Best Practices for NanoSite

Date: 2025-01-15

This guide shows you how to optimize your NanoSite content for search engines while maintaining the "no compilation needed" philosophy.

## Writing SEO-Friendly Content

Your markdown files are automatically optimized for SEO when you follow these simple practices:

### Use Descriptive Titles
Start each post with a clear, descriptive H1 heading (using `#`). This becomes your page title in search results.

### Include Publication Dates
Add a date field near the top of your content:
```
Date: 2025-01-15
```

This helps search engines understand when your content was published and keeps it fresh.

### Write Compelling First Paragraphs
The first paragraph of your post becomes the meta description for search engines. Keep it under 155 characters and make it compelling - this is what people see in search results.

### Add Images for Social Sharing
Include relevant images in your posts. They'll be used for social media previews when people share your content.

## Automatic SEO Features

NanoSite automatically handles:

- **Meta Tags**: Title, description, keywords for each page
- **Open Graph**: Facebook and social media sharing optimization  
- **Twitter Cards**: Optimized Twitter sharing previews
- **Structured Data**: Helps search engines understand your content
- **Canonical URLs**: Prevents duplicate content issues
- **Sitemap Generation**: Use the included sitemap generator tool

## Site-Level SEO Configuration

Update your `site.json` file with SEO information:

```json
{
  "siteTitle": { "default": "Your Amazing Blog" },
  "siteDescription": { "default": "Insights about technology, life, and everything in between" },
  "siteUrl": "https://yourdomain.com/",
  "siteKeywords": { "default": "blog, technology, writing, thoughts" }
}
```

This information is used across your entire site for consistent SEO optimization.

## Performance Benefits

Unlike traditional static site generators that require compilation, NanoSite:

- ✅ Loads instantly (no build step delays)
- ✅ Updates immediately when you edit files
- ✅ Works on any static hosting (GitHub Pages, Netlify, etc.)
- ✅ Requires zero technical setup
- ✅ Maintains full SEO optimization

The best SEO is great content that loads fast and provides value to readers. NanoSite handles the technical details so you can focus on writing.

## SEO File Generation

NanoSite includes a comprehensive SEO generator tool:

1. Open `seo-generator.html` in your browser
2. **Sitemap Generator**: Creates XML sitemap with all your posts and pages
3. **Robots.txt Generator**: Creates optimized robots.txt for search engines
4. **Configuration Viewer**: Check your current site settings
5. Copy or download the generated files to your root directory

The tool automatically uses your site configuration and content to create optimized SEO files.

## Next Steps

1. Edit your `site.json` with your site information
2. Write your first post following these guidelines  
3. Use the SEO generator to create sitemap.xml and robots.txt
4. Share your content and watch your search rankings improve!

Remember: Search engines love fresh, valuable content. The "no compilation needed" approach means you can update and publish instantly, keeping your site active and engaging.
