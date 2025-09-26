// Simple i18n helper for NanoSite
// Usage & extension:
// - To change the default language, edit DEFAULT_LANG below (or set <html lang="xx"> in index.html; boot code passes that into initI18n).
// - To add a new UI language, add a new top-level key to `translations` (e.g., `es`, `fr`) mirroring the `en` structure.
// - Content i18n supports a single unified YAML with per-language entries and default fallback.
//   Prefer using one `wwwroot/index.yaml` that stores, per post, a `default` block and optional language blocks
//   (e.g., `en`, `zh`, `ja`) describing `title` and `location`. Missing languages fall back to `default`.
//   Legacy per-language files like `index.<lang>.yaml` and `tabs.<lang>.yaml` are also supported.
// - To show a friendly name in the language dropdown, add an entry to `languageNames`.

import { parseFrontMatter } from './content.js';
import { getContentRoot } from './utils.js';
import { fetchConfigWithYamlFallback } from './yaml.js';

// Fetch of content files uses { cache: 'no-store' } to avoid stale data

// Default language fallback when no user/browser preference is available.
const DEFAULT_LANG = 'en';
// Site base default language (can be overridden by initI18n via <html lang>)
let baseDefaultLang = DEFAULT_LANG;
const STORAGE_KEY = 'lang';

// Export the default language constant for use by other modules
export { DEFAULT_LANG };

// UI translation bundles. Add new languages by copying the `en` structure
// and translating values. Missing keys will fall back to `en`.
const translations = {
  en: {
    ui: {
      allPosts: 'All Posts',
      searchTab: 'Search',
      postTab: 'Post',
      prev: 'Prev',
      next: 'Next',
      contents: 'Contents',
      loading: 'Loading…',
      top: 'Top',
      minRead: 'min read',
      close: 'Close',
      copyLink: 'Copy link',
      linkCopied: 'Link copied',
      versionLabel: 'Version',
      versionsCount: (n) => `${n} versions`,
      latestSuffix: '(latest)',
      outdatedWarning: 'Caution: This blog post may contain outdated information as it has been published a long time ago.',
      notFound: 'Not Found',
      pageUnavailable: 'Page Unavailable',
      indexUnavailable: 'Index unavailable',
      backToAllPosts: 'Back to all posts',
      backToHome: 'Back to home',
      noResultsTitle: 'No results',
      noResultsBody: (q) => `No posts found for "${q}".`,
      tags: 'Tags',
      tagSearch: (tag) => `Tag: ${tag}`,
      allTags: 'All tags',
      more: 'More',
      less: 'Less',
      details: 'Details',
      copyDetails: 'Copy details',
      reportIssue: 'Report issue',
      warning: 'Warning',
      error: 'Error',
      aiFlagLabel: 'AI-assisted',
      aiFlagTooltip: 'AI-assisted: generated or edited with an LLM',
      draftBadge: 'Draft',
      draftNotice: 'This post is a draft and may change.'
    },
    code: {
      copy: 'Copy',
      copied: 'Copied!',
      failed: 'Copy failed',
      copyAria: 'Copy code'
    },
    errors: {
      postNotFoundTitle: 'Post not found',
      postNotFoundBody: 'The requested post could not be loaded.',
      pageUnavailableTitle: 'Page unavailable',
      pageUnavailableBody: 'Could not load this tab.',
      indexUnavailableBody: 'Could not load the post index. Check network or repository contents.'
    },
    sidebar: {
      searchPlaceholder: 'Search posts...',
      siteTitle: "Phyllali's Blog",
      siteSubtitle: 'Thanks for playing my game.',
      socialGithub: 'GitHub'
    },
    tools: {
      sectionTitle: 'Function Area',
      toggleTheme: 'Toggle Theme',
      postEditor: 'Markdown Editor',
      themePack: 'Theme pack',
      language: 'Language',
      resetLanguage: 'Reset language',
      seoGenerator: 'SEO Generator'
    },
    toc: {
      toggleAria: 'Toggle section',
      copied: 'Copied!'
    },
    titles: {
      allPosts: 'All Posts',
      search: (q) => `Search: ${q}`
    },
    editor: {
      pageTitle: 'Markdown Editor - NanoSite',
      languageLabel: 'Language',
      verifying: 'Verifying…',
      verify: 'Verify',
      nav: {
        modeSwitchAria: 'Mode switch',
        dynamicTabsAria: 'Open editor tabs'
      },
      modes: {
        composer: 'Composer',
        editor: 'Editor'
      },
      status: {
        localLabel: 'LOCAL',
        checkingDrafts: 'Checking drafts…',
        synced: 'Synced',
        upload: 'UPLOAD',
        remoteLabel: 'GitHub',
        loadingRepo: 'Loading GitHub settings…',
        checkingConnection: 'Checking connection…',
        clean: 'No local changes'
      },
      currentFile: {
        status: {
          checking: 'Checking file…',
          existing: 'Existing file',
          missing: 'New file',
          error: 'Failed to load file'
        },
        meta: {
          checking: 'Checking…',
          checkingStarted: ({ time }) => `Checking… started ${time}`,
          lastChecked: ({ time }) => `Last checked: ${time}`
        },
        draft: {
          justNow: 'just now',
          savedHtml: ({ time }) => `Local draft saved ${time}`,
          saved: 'Local draft saved',
          savedConflictHtml: ({ time }) => `Local draft saved ${time} (remote updated)`,
          conflict: 'Local draft (remote updated)',
          available: 'Local draft available'
        }
      },
      toolbar: {
        wrap: 'Wrap:',
        wrapOn: 'on',
        wrapOff: 'off',
        view: 'View:',
        viewEdit: 'Editor',
        viewPreview: 'Preview',
        discard: 'Discard',
        wrapAria: 'Wrap setting',
        viewAria: 'View switch'
      },
      toast: {
        openAction: 'Open',
        closeAria: 'Close notification'
      },
      toasts: {
        remoteMarkdownMismatch: 'Remote markdown differs from the local draft. Review the changes before continuing.',
        markdownSynced: 'Markdown synchronized with GitHub.',
        remoteCheckCanceledUseRefresh: 'Remote check canceled. Use Refresh after your commit is ready.',
        yamlParseFailed: ({ label }) => `Fetched ${label} but failed to parse YAML.`,
        yamlUpdatedDifferently: ({ label }) => `${label} was updated differently on GitHub. Review the highlighted differences.`,
        yamlSynced: ({ label }) => `${label} synchronized with GitHub.`,
        remoteCheckCanceledClickRefresh: 'Remote check canceled. Click Refresh when your commit is ready.',
        popupBlocked: 'Your browser blocked the GitHub window. Allow pop-ups for this site and try again.',
        openGithubAction: 'Open GitHub',
        markdownOpenBeforeInsert: 'Open a markdown file before inserting images.',
        assetAttached: ({ label }) => `Attached ${label}`,
        noPendingChanges: 'No pending changes to commit.',
        siteWaitStopped: 'Stopped waiting for the live site. Your commit is already on GitHub, but it may take a few minutes to appear.',
        siteWaitTimedOut: 'Committed files to GitHub, but the live site did not update in time. Check the deploy status manually.',
        commitSuccess: ({ count }) => `Committed ${count} ${count === 1 ? 'file' : 'files'} to GitHub.`,
        githubCommitFailed: 'GitHub commit failed.',
        githubTokenRejected: 'GitHub rejected the access token. Enter a new Fine-grained Personal Access Token.',
        repoOwnerMissing: 'Configure repo.owner and repo.name in site.yaml to enable GitHub synchronization.',
        markdownOpenBeforePush: 'Open a markdown file before pushing to GitHub.',
        repoConfigMissing: 'Configure repo in site.yaml to enable GitHub push.',
        invalidMarkdownPath: 'Invalid markdown path.',
        unableLoadLatestMarkdown: 'Unable to load the latest markdown before pushing.',
        markdownNotReady: 'Markdown file is not ready to push yet.',
        unableResolveGithubFile: 'Unable to resolve GitHub URL for this file.',
        markdownOpenBeforeDiscard: 'Open a markdown file before discarding local changes.',
        noLocalMarkdownChanges: 'No local markdown changes to discard.',
        discardSuccess: ({ label }) => `Discarded local changes for ${label}.`,
        discardFailed: 'Failed to discard local markdown changes.',
        unableResolveYamlSync: 'Unable to resolve GitHub URL for YAML synchronization.',
        yamlUpToDate: ({ name }) => `${name} is up to date.`,
        yamlCopiedNoRepo: 'YAML copied. Configure repo in site.yaml to open GitHub.'
      },
      editorTools: {
        aria: 'Editor tools',
        formatGroupAria: 'Formatting shortcuts',
        bold: 'Bold',
        italic: 'Italic',
        strike: 'Strikethrough',
        heading: 'Heading',
        quote: 'Quote',
        code: 'Inline code',
        codeBlock: 'Code Block',
        articleCard: 'Article Card',
        insertCardTitle: 'Insert article card',
        insertImage: 'Insert Image',
        cardDialogAria: 'Insert article card',
        cardSearch: 'Search articles…',
        cardEmpty: 'No matching articles',
        hints: {
          bold: 'No text is selected. Select text first, then click Bold to surround it with ** **.',
          italic: 'No text is selected. Select text first, then click Italic to surround it with * *.',
          strike: 'No text is selected. Select text first, then click Strikethrough to surround it with ~~ ~~.',
          heading: 'Select lines or place the caret on an empty line, then click Heading to prepend "# ".',
          quote: 'Select lines or place the caret on an empty line, then click Quote to prepend "> ".',
          code: 'No text is selected. Select text first, then click Code to wrap it in backticks.',
          codeBlock: 'Select lines or place the caret on an empty line, then click Code Block to wrap them in ``` fences.',
          insertCard: 'Place the caret on an empty line, then click to insert an article card. If no articles appear, wait for the index to load or add entries in index.yaml.'
        }
      },
      editorPlaceholder: '# Hello NanoSite\n\nStart typing Markdown…',
      editorTextareaAria: 'Markdown source',
      empty: {
        title: 'No editor is currently open',
        body: 'Open Markdown from the Composer to start editing.'
      },
      composer: {
        fileSwitchAria: 'File switch',
        fileLabel: 'File:',
        fileArticles: 'Articles',
        filePages: 'Pages',
        fileSite: 'Site',
        addPost: 'Add Post Entry',
        addTab: 'Add Tab Entry',
        refresh: 'Refresh',
        refreshTitle: 'Fetch latest remote snapshot',
        refreshing: 'Refreshing…',
        discard: 'Discard',
        discardTitle: 'Discard local draft and reload remote file',
        changeSummary: 'Change summary',
        reviewChanges: 'Review changes',
        inlineEmpty: 'No entries to compare yet.',
        indexInlineAria: 'Old order for index.yaml',
        indexEditorAria: 'index.yaml editor',
        tabsInlineAria: 'Old order for tabs.yaml',
        tabsEditorAria: 'tabs.yaml editor',
        siteEditorAria: 'site.yaml editor',
        noLocalChangesToCommit: 'No local changes to commit.',
        noLocalChangesYet: 'No local changes yet.',
        dialogs: {
          cancel: 'Cancel',
          confirm: 'Confirm'
        },
        statusMessages: {
          loadingConfig: 'Loading config…',
          restoredDraft: ({ label }) => `Restored local draft for ${label}`,
          refreshSuccess: ({ name }) => `${name} refreshed from remote`,
          remoteUpdated: 'Remote snapshot updated. Highlights now include remote differences.',
          remoteUnchanged: 'Remote snapshot unchanged.',
          refreshFailed: 'Failed to refresh remote snapshot'
        },
        site: {
          addLanguage: 'Add language',
          removeLanguage: 'Remove',
          noLanguages: 'No languages configured yet.',
          promptLanguage: 'Enter a language code (for example: en, zh, ja):',
          languageExists: 'That language already exists.',
          languageDefault: 'Default',
          languageAutoOption: 'Auto-detect (browser language)',
          reset: 'Reset override',
          addLink: 'Add link',
          removeLink: 'Remove',
          noLinks: 'No links configured.',
          linkLabelPlaceholder: 'Label',
          linkHrefPlaceholder: 'https://example.com',
          toggleEnabled: 'Enable',
          optionShow: 'Show',
          optionHide: 'Hide',
          repoOwner: 'Repository owner',
          repoName: 'Repository name',
          repoBranch: 'Branch (optional)',
          sections: {
            identity: {
              title: 'Identity',
              description: 'Customize the site title, subtitle, and avatar shown in navigation.'
            },
            seo: {
              title: 'SEO & sharing',
              description: 'Provide metadata used for search engines and link previews.'
            },
            behavior: {
              title: 'Behavior',
              description: 'Control pagination, landing behavior, and All Posts visibility.'
            },
            theme: {
              title: 'Theme',
              description: 'Pick default theme settings applied to visitors.'
            },
            repo: {
              title: 'Repository',
              description: 'Configure GitHub details for commits and issue links.'
            },
            assets: {
              title: 'Asset warnings',
              description: 'Warn editors about large image uploads.'
            },
            extras: {
              title: 'Other keys',
              description: 'Read-only keys detected in site.yaml (not editable here).'
            }
          },
          fields: {
            siteTitle: 'Site title',
            siteTitleHelp: 'Shown as the main title in navigation and metadata.',
            siteSubtitle: 'Site subtitle',
            siteSubtitleHelp: 'Displayed beneath the title in navigation.',
            avatar: 'Avatar',
            avatarHelp: 'Relative path or URL to the avatar image.',
            resourceURL: 'Resource URL',
            resourceURLHelp: 'Absolute URL that points to the published /wwwroot folder (optional).',
            contentRoot: 'Content root',
            contentRootHelp: 'Folder containing index.yaml and tabs.yaml.',
            siteDescription: 'Site description',
            siteDescriptionHelp: 'Optional description used for SEO and link previews.',
            siteKeywords: 'Site keywords',
            siteKeywordsHelp: 'Comma-separated keywords for SEO (optional).',
            profileLinks: 'Profile links',
            profileLinksHelp: 'List of profile or social links shown near the avatar.',
            navLinks: 'Navigation links',
            navLinksHelp: 'Custom links shown in the navigation menu.',
            defaultLanguage: 'Default language',
            defaultLanguageHelp: 'Language code to use when no browser preference is matched.',
            contentOutdatedDays: 'Outdated threshold (days)',
            contentOutdatedDaysHelp: 'Highlight posts older than this many days. Leave blank to disable.',
            pageSize: 'Posts per page',
            pageSizeHelp: 'Maximum number of posts to display on the All Posts page.',
            showAllPosts: 'All Posts tab',
            showAllPostsHelp: 'Show the All Posts tab alongside other navigation tabs.',
            landingTab: 'Landing tab',
            landingTabHelp: 'Choose which tab opens first when the site loads.',
            landingTabAllPostsOption: 'All Posts tab',
            cardCoverFallback: 'Fallback card cover',
            cardCoverFallbackHelp: 'Generate a fallback cover image when a post has no cover.',
            errorOverlay: 'Error overlay',
            errorOverlayHelp: 'Show a client-side error overlay when runtime errors occur.',
            themeMode: 'Theme mode',
            themeModeHelp: 'Default theme mode (user/system/light/dark).',
            themePack: 'Theme pack',
            themePackHelp: 'Theme pack folder to load by default.',
            themeOverride: 'Lock theme',
            themeOverrideHelp: 'Force the selected theme even if visitors change it.',
            repo: 'GitHub repository',
            repoHelp: 'Required for commits, push to GitHub, and issue links.',
            assetLargeImage: 'Warn about large images',
            assetLargeImageHelp: 'Show a warning when attached images exceed the threshold.',
            assetLargeImageThreshold: 'Large image threshold (KB)',
            assetLargeImageThresholdHelp: 'File size in kilobytes that triggers the warning. Leave blank to use the default.',
            extras: 'Preserved keys',
            extrasHelp: 'These keys stay in site.yaml but must be edited manually.'
          }
        },
        entryRow: {
          gripHint: 'Drag to reorder',
          details: 'Details',
          delete: 'Delete'
        },
        languages: {
          count: ({ count }) => `${count} ${count === 1 ? 'language' : 'languages'}`,
          addVersion: '+ Version',
          removeLanguage: 'Remove language',
          addLanguage: '+ Add language',
          removedVersions: ({ versions }) => `Removed: ${versions}`,
          placeholders: {
            indexPath: 'post/.../file.md',
            tabPath: 'tab/.../file.md'
          },
          fields: {
            title: 'Title',
            location: 'Location'
          },
          actions: {
            edit: 'Edit',
            open: 'Open in editor',
            moveUp: 'Move up',
            moveDown: 'Move down',
            remove: 'Remove'
          }
        },
        entryKinds: {
          post: {
            label: 'post',
            confirm: 'Add Post Entry',
            placeholder: 'Post key',
            message: 'Enter a new post key (letters and numbers only):'
          },
          tab: {
            label: 'tab',
            confirm: 'Add Tab Entry',
            placeholder: 'Tab key',
            message: 'Enter a new tab key (letters and numbers only):'
          }
        },
        diff: {
          heading: 'Changes',
          title: ({ label }) => `Changes — ${label}`,
          close: 'Close',
          subtitle: {
            default: 'Review differences compared to the remote baseline.',
            overview: 'Review a quick summary of the unsynced changes.',
            entries: 'Inspect added, removed, and modified entries.',
            order: 'Remote baseline (left) · Current order (right)'
          },
          tabs: {
            overview: 'Overview',
            entries: 'Entries',
            order: 'Order'
          },
          order: {
            remoteTitle: 'Remote',
            currentTitle: 'Current',
            empty: 'No items to compare yet.',
            inlineAllNew: 'All current items are new compared with the baseline.',
            emptyKey: '(empty)',
            badges: {
              to: ({ index }) => `→ #${index}`,
              from: ({ index }) => `from #${index}`,
              removed: 'Removed',
              added: 'New'
            }
          },
          orderStats: {
            empty: 'No direct moves; changes come from additions/removals',
            moved: ({ count }) => `Moved ${count}`,
            added: ({ count }) => `+${count} new`,
            removed: ({ count }) => `-${count} removed`
          },
          lists: {
            more: ({ count }) => `+${count} more`
          },
          inlineChips: {
            added: ({ count }) => `+${count} added`,
            removed: ({ count }) => `-${count} removed`,
            modified: ({ count }) => `~${count} modified`,
            orderChanged: 'Order changed',
            orderParts: {
              moved: ({ count }) => `${count} moved`,
              added: ({ count }) => `+${count} new`,
              removed: ({ count }) => `-${count} removed`
            },
            orderSummary: ({ parts }) => `Order: ${parts}`,
            langs: ({ summary }) => `Langs: ${summary}`,
            none: 'Changes detected.'
          },
          inline: {
            title: 'Change summary',
            ariaOrder: ({ label }) => `Old order for ${label}`,
            openAria: ({ label }) => `Open change overview for ${label}`
          },
          overview: {
            empty: 'No changes detected for this file.',
            stats: {
              added: 'Added',
              removed: 'Removed',
              modified: 'Modified',
              order: 'Order',
              changed: 'Changed',
              unchanged: 'Unchanged'
            },
            blocks: {
              added: 'Added entries',
              removed: 'Removed entries',
              modified: 'Modified entries'
            },
            languagesImpacted: ({ languages }) => `Languages impacted: ${languages}`
          },
          entries: {
            noLanguageContent: 'No language content recorded.',
            snapshot: {
              indexValue: ({ count }) => `${count} value${count === 1 ? '' : 's'}`,
              emptyEntry: 'empty entry',
              tabTitle: ({ title }) => `title “${title}”`,
              tabLocation: ({ location }) => `location ${location}`
            },
            summary: ({ lang, summary }) => `${lang}: ${summary}`,
            state: {
              added: ({ lang }) => `${lang}: added`,
              removed: ({ lang }) => `${lang}: removed`,
              updatedFields: ({ lang, fields }) => `${lang}: updated ${fields}`
            },
            parts: {
              typeChanged: 'type changed',
              addedCount: ({ count }) => `+${count} new`,
              removedCount: ({ count }) => `-${count} removed`,
              updatedCount: ({ count }) => `${count} updated`,
              reordered: 'reordered',
              contentUpdated: 'content updated'
            },
            join: {
              comma: ', ',
              and: ' & '
            },
            fields: {
              title: 'title',
              location: 'location',
              content: 'content'
            },
            empty: 'No content differences detected.',
            sections: {
              added: 'Added entries',
              removed: 'Removed entries',
              modified: 'Modified entries'
            },
            orderOnly: 'Only ordering changed for this file.'
          }
        },
        github: {
          modal: {
            title: 'Synchronize with GitHub',
            subtitle: 'Provide a Fine-grained Personal Access Token with repository contents access.',
            summaryTitle: 'The following files will be committed:',
            tokenLabel: 'Fine-grained Personal Access Token',
            helpHtml: 'Create a token at <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">github.com/settings/tokens</a> with access to the repository\'s contents. The token is stored for this browser session only.',
            forget: 'Forget token',
            submit: 'Commit changes',
            errorRequired: 'Enter a Fine-grained Personal Access Token to continue.'
          }
        },
        dialogs: {
          cancel: 'Cancel',
          confirm: 'Confirm'
        },
        addEntryPrompt: {
          hint: 'Use only English letters and numbers.',
          confirm: 'Add Entry',
          defaultType: 'entry',
          placeholder: 'Entry key',
          message: ({ label }) => `Enter a new ${label} key:`,
          errorEmpty: 'Key cannot be empty.',
          errorInvalid: 'Key must contain only English letters, numbers, underscores, or hyphens.',
          errorDuplicate: 'That key already exists. Choose a different key.'
        },
        discardConfirm: {
          messageReload: ({ label }) => `Discard local changes for ${label} and reload the remote file? This action cannot be undone.`,
          messageSimple: ({ label }) => `Discard local changes for ${label}? This action cannot be undone.`,
          closeTabMessage: ({ label }) => `Close ${label}? Closing this tab will discard local markdown changes.`,
          closeTabFallback: 'this tab',
          discard: 'Discard',
          discarding: 'Discarding…',
          successFresh: ({ label }) => `Discarded local changes; loaded fresh ${label}`,
          successCached: ({ label }) => `Discarded local changes; restored ${label} from cached snapshot`,
          failed: 'Failed to discard local changes'
        },
        markdown: {
          push: {
            labelDefault: 'Synchronize',
            labelCreate: 'Create on GitHub',
            labelUpdate: 'Synchronize',
            tooltips: {
              default: 'Copy draft to GitHub.',
              noRepo: 'Configure repo in site.yaml to enable GitHub push.',
              noFile: 'Open a markdown file to enable GitHub push.',
              error: 'Resolve file load error before pushing to GitHub.',
              checking: 'Checking remote version…',
              loading: 'Loading remote snapshot…',
              create: 'Copy draft and create this file on GitHub.',
              update: 'Copy draft and update this file on GitHub.'
            }
          },
          discard: {
            label: 'Discard',
            busy: 'Discarding…',
            tooltips: {
              default: 'Discard local markdown changes and restore the last loaded version.',
              noFile: 'Open a markdown file to discard local changes.',
              reload: 'Discard local markdown changes (remote snapshot will be reloaded).'
            }
          },
          draftIndicator: {
            conflict: 'Local draft conflicts with remote file.',
            dirty: 'Unsaved changes pending in editor.',
            saved: 'Local draft saved in browser.'
          },
          currentFile: 'current file',
          fileFallback: 'markdown file',
          openBeforeEditor: 'Enter a markdown location before opening the editor.',
          toastCopiedCreate: 'Markdown copied. GitHub will open to create this file.',
          toastCopiedUpdate: 'Markdown copied. GitHub will open to update this file.',
          blockedCreate: 'Markdown copied. Click “Open GitHub” if the new tab did not appear so you can create this file.',
          blockedUpdate: 'Markdown copied. Click “Open GitHub” if the new tab did not appear so you can update this file.'
        },
        yaml: {
          toastCopiedUpdate: ({ name }) => `${name} copied. GitHub will open so you can paste the update.`,
          toastCopiedCreate: ({ name }) => `${name} copied. GitHub will open so you can create the file.`,
          blocked: ({ name }) => `${name} copied. Click “Open GitHub” if the new tab did not appear.`
        },
        remoteWatcher: {
          waitingForCreate: ({ label }) => `Waiting for GitHub to create ${label}`,
          waitingForUpdate: ({ label }) => `Waiting for GitHub to update ${label}`,
          waitingForCommitStatus: 'Waiting for GitHub commit…',
          checkingRemoteChanges: 'Checking remote changes…',
          waitingForCommit: 'Waiting for commit…',
          stopWaiting: 'Stop waiting',
          waitingForRemoteResponse: 'Waiting for remote response…',
          remoteCheckFailedRetry: 'Remote check failed. Retrying…',
          remoteFileNotFoundYet: 'Remote file not found yet…',
          remoteFileStillMissing: 'Remote file still missing…',
          updateDetectedRefreshing: 'Update detected. Refreshing…',
          remoteFileDiffersWaiting: 'Remote file still differs from local content. Waiting…',
          remoteFileExistsDiffersWaiting: 'Remote file exists but content differs. Waiting…',
          mismatchAdvice: 'If your GitHub commit intentionally differs, cancel and use Refresh to review it.',
          remoteCheckCanceled: 'Remote check canceled',
          errorWithDetail: ({ message }) => `Error: ${message}`,
          networkError: 'Network error',
          fileNotFoundOnServer: 'File not found on server',
          remoteSnapshotUpdated: 'Remote snapshot updated',
          waitingForGitHub: 'Waiting for GitHub…',
          preparing: 'Preparing…',
          waitingForLabel: ({ label }) => `Waiting for ${label} to update on GitHub…`,
          waitingForRemote: 'Waiting for remote…',
          yamlNotFoundYet: ({ label }) => `${label} not found on remote yet…`,
          remoteYamlDiffersWaiting: 'Remote YAML still differs from the local snapshot. Waiting…',
          remoteYamlExistsDiffersWaiting: 'Remote YAML updated but content differs. Waiting…',
          yamlMismatchAdvice: 'If the commit was different from your draft, cancel and click Refresh to pull it in.'
        },
      },
      github: {
        status: {
          arrowWarn: 'Check repo',
          arrowDefault: 'Status',
          loadingRepo: 'Loading GitHub settings…',
          readingConfig: 'Reading site.yaml for GitHub connection details…',
          repoNotConfigured: 'GitHub repository not configured',
          repoConfigHint: 'Add repo.owner and repo.name to site.yaml to enable pushing your drafts.',
          checkingRepo: 'Checking repository access…',
          rateLimited: 'GitHub rate limit hit. Try again later.',
          repoNotFound: 'Repository not found on GitHub.',
          networkError: 'Could not reach GitHub. Check your connection.',
          repoCheckFailed: 'Repository check failed.',
          repoConnectedDefault: ({ branch }) => `Repository connected · Default branch “${branch}”`,
          checkingBranch: 'Checking branch access…',
          branchNotFound: 'Branch not found on GitHub.',
          branchCheckFailed: 'Branch check failed.',
          repoConnected: 'Repository connected',
          configUnavailable: 'GitHub configuration unavailable',
          readFailed: 'Failed to read site.yaml.'
        }
      },
      footerNote: 'Crafted with ❤️ using <a href="https://deemoe404.github.io/NanoSite/" target="_blank" rel="noopener">NanoSite</a>. Stay inspired and keep creating.'
    }
  },
  zh: {
    ui: {
      allPosts: '全部文章',
      searchTab: '搜索',
      postTab: '文章',
      prev: '上一页',
      next: '下一页',
      contents: '目录',
      loading: '加载中…',
      top: '顶部',
      minRead: '分钟阅读',
      close: '关闭',
      copyLink: '复制链接',
      linkCopied: '已复制链接',
      versionLabel: '版本',
      versionsCount: (n) => `${n} 个版本`,
      latestSuffix: '（最新）',
      outdatedWarning: '提示：这篇文章发布已久，内容可能已过时。',
      notFound: '未找到',
      pageUnavailable: '页面不可用',
      indexUnavailable: '索引不可用',
      backToAllPosts: '返回全部文章',
      backToHome: '返回首页',
      noResultsTitle: '没有结果',
      noResultsBody: (q) => `未找到与 “${q}” 匹配的文章。`,
      tags: '标签',
      tagSearch: (tag) => `标签：${tag}`,
      allTags: '全部标签',
      more: '更多',
      less: '收起',
      details: '详情',
      copyDetails: '复制详情',
      reportIssue: '报告问题',
      warning: '警告',
      error: '错误',
      aiFlagLabel: 'AI 参与',
      aiFlagTooltip: 'AI 参与：本文由生成式 LLM 生成或修改',
      draftBadge: '草稿',
      draftNotice: '本文仍在撰写/修改中，内容可能随时变更。'
    },
    code: {
      copy: '复制',
      copied: '已复制',
      failed: '复制失败',
      copyAria: '复制代码'
    },
    errors: {
      postNotFoundTitle: '文章未找到',
      postNotFoundBody: '无法加载所请求的文章。',
      pageUnavailableTitle: '页面不可用',
      pageUnavailableBody: '无法加载该页面。',
      indexUnavailableBody: '无法加载文章索引。请检查网络或仓库内容。'
    },
    sidebar: {
      searchPlaceholder: '搜索文章…',
      siteTitle: 'Phyllali 的博客',
      siteSubtitle: '感谢游玩我的游戏。',
      socialGithub: 'GitHub'
    },
    tools: {
      sectionTitle: '功能区',
      toggleTheme: '切换主题',
      postEditor: '文章编辑器',
      themePack: '主题包',
      language: '语言',
      resetLanguage: '重置语言',
      seoGenerator: 'SEO 生成器'
    },
    toc: {
      toggleAria: '展开/折叠章节',
      copied: '已复制！'
    },
    titles: {
      allPosts: '全部文章',
      search: (q) => `搜索：${q}`
    },
    editor: {
      pageTitle: 'Markdown 编辑器 - NanoSite',
      languageLabel: '语言',
      verifying: '正在验证…',
      verify: '验证',
      nav: {
        modeSwitchAria: '模式切换',
        dynamicTabsAria: '打开编辑器标签'
      },
      modes: {
        composer: '编排器',
        editor: '编辑器'
      },
      status: {
        localLabel: '本地',
        checkingDrafts: '正在检查草稿…',
        synced: '已同步',
        upload: '上传',
        remoteLabel: 'GitHub',
        loadingRepo: '正在加载 GitHub 设置…',
        checkingConnection: '正在检查连接…',
        clean: '没有本地更改'
      },
      currentFile: {
        status: {
          checking: '正在检查文件…',
          existing: '已存在的文件',
          missing: '新文件',
          error: '无法加载文件'
        },
        meta: {
          checking: '正在检查…',
          checkingStarted: ({ time }) => `正在检查… 开始于${time}`,
          lastChecked: ({ time }) => `上次检查：${time}`
        },
        draft: {
          justNow: '刚刚',
          savedHtml: ({ time }) => `本地草稿已于${time}保存`,
          saved: '本地草稿已保存',
          savedConflictHtml: ({ time }) => `本地草稿已于${time}保存（远端已更新）`,
          conflict: '本地草稿（远端已更新）',
          available: '本地草稿可用'
        }
      },
      toolbar: {
        wrap: '换行：',
        wrapOn: '开',
        wrapOff: '关',
        view: '视图：',
        viewEdit: '编辑',
        viewPreview: '预览',
        discard: '丢弃',
        wrapAria: '换行设置',
        viewAria: '视图切换'
      },
      toast: {
        openAction: '打开',
        closeAria: '关闭通知'
      },
      toasts: {
        remoteMarkdownMismatch: '远程 Markdown 与本地草稿不同。继续前请检查差异。',
        markdownSynced: 'Markdown 已与 GitHub 同步。',
        remoteCheckCanceledUseRefresh: '远程检查已取消。提交准备好后请点击“刷新”。',
        yamlParseFailed: ({ label }) => `已获取 ${label}，但无法解析 YAML。`,
        yamlUpdatedDifferently: ({ label }) => `${label} 在 GitHub 上的更新不同。请检查高亮的差异。`,
        yamlSynced: ({ label }) => `${label} 已与 GitHub 同步。`,
        remoteCheckCanceledClickRefresh: '远程检查已取消。提交准备好后请点击“刷新”。',
        popupBlocked: '浏览器阻止了 GitHub 窗口。请允许此站点的弹出窗口后重试。',
        openGithubAction: '打开 GitHub',
        markdownOpenBeforeInsert: '请先打开一个 Markdown 文件再插入图片。',
        assetAttached: ({ label }) => `已附加 ${label}`,
        noPendingChanges: '没有待提交的更改。',
        siteWaitStopped: '已停止等待线上站点。提交已在 GitHub 上，但显示可能还需要几分钟。',
        siteWaitTimedOut: '已将文件提交到 GitHub，但线上站点未及时更新。请手动检查部署状态。',
        commitSuccess: ({ count }) => `已将 ${count} 个文件提交到 GitHub。`,
        githubCommitFailed: '提交到 GitHub 失败。',
        githubTokenRejected: 'GitHub 拒绝了访问令牌。请输入新的细粒度个人访问令牌。',
        repoOwnerMissing: '请在 site.yaml 中配置 repo.owner 和 repo.name 以启用 GitHub 同步。',
        markdownOpenBeforePush: '请先打开一个 Markdown 文件再推送到 GitHub。',
        repoConfigMissing: '请在 site.yaml 中配置仓库信息以启用 GitHub 推送。',
        invalidMarkdownPath: '无效的 Markdown 路径。',
        unableLoadLatestMarkdown: '在推送前无法加载最新的 Markdown。',
        markdownNotReady: 'Markdown 文件尚未准备好推送。',
        unableResolveGithubFile: '无法解析此文件的 GitHub 链接。',
        markdownOpenBeforeDiscard: '请先打开一个 Markdown 文件再丢弃本地更改。',
        noLocalMarkdownChanges: '没有可丢弃的本地 Markdown 更改。',
        discardSuccess: ({ label }) => `已丢弃 ${label} 的本地更改。`,
        discardFailed: '丢弃本地 Markdown 更改失败。',
        unableResolveYamlSync: '无法解析用于 YAML 同步的 GitHub 链接。',
        yamlUpToDate: ({ name }) => `${name} 已是最新。`,
        yamlCopiedNoRepo: '已复制 YAML。请在 site.yaml 中配置仓库以打开 GitHub。'
      },
      editorTools: {
        aria: '编辑器工具',
        formatGroupAria: '格式快捷键',
        bold: '加粗',
        italic: '斜体',
        strike: '删除线',
        heading: '标题',
        quote: '引用',
        code: '行内代码',
        codeBlock: '代码块',
        articleCard: '文章卡片',
        insertCardTitle: '插入文章卡片',
        insertImage: '插入图片',
        cardDialogAria: '插入文章卡片',
        cardSearch: '搜索文章…',
        cardEmpty: '没有匹配的文章',
        hints: {
          bold: '未选择文本。先选中文本，再点击“加粗”以用 ** ** 包裹。',
          italic: '未选择文本。先选中文本，再点击“斜体”以用 * * 包裹。',
          strike: '未选择文本。先选中文本，再点击“删除线”以用 ~~ ~~ 包裹。',
          heading: '选中行或将光标放在空行上，然后点击“标题”在前面加上“# ”。',
          quote: '选中行或将光标放在空行上，然后点击“引用”在前面加上“> ”。',
          code: '未选择文本。先选中文本，再点击“行内代码”以用反引号包裹。',
          codeBlock: '选中行或将光标放在空行上，然后点击“代码块”以用 ``` 包裹。',
          insertCard: '将光标放在空行上，然后点击以插入文章卡片。若没有文章，请等待索引加载或在 index.yaml 中添加条目。'
        }
      },
      editorPlaceholder: '# 你好，NanoSite\n\n开始撰写 Markdown…',
      editorTextareaAria: 'Markdown 源',
      empty: {
        title: '当前没有打开编辑器',
        body: '从编排器打开 Markdown 以开始编辑。'
      },
      composer: {
        fileSwitchAria: '文件切换',
        fileLabel: '文件：',
        fileArticles: '文章',
        filePages: '页面',
        fileSite: '站点',
        addPost: '添加文章条目',
        addTab: '添加标签条目',
        refresh: '刷新',
        refreshTitle: '获取最新远程快照',
        refreshing: '正在刷新…',
        discard: '丢弃',
        discardTitle: '丢弃本地草稿并重新加载远程文件',
        changeSummary: '更改摘要',
        reviewChanges: '查看更改',
        inlineEmpty: '暂无可比较的条目。',
        indexInlineAria: 'index.yaml 的旧顺序',
        indexEditorAria: 'index.yaml 编辑器',
        tabsInlineAria: 'tabs.yaml 的旧顺序',
        tabsEditorAria: 'tabs.yaml 编辑器',
        siteEditorAria: 'site.yaml 编辑器',
        noLocalChangesToCommit: '没有本地更改可提交。',
        noLocalChangesYet: '暂时没有本地更改。',
        dialogs: {
          cancel: '取消',
          confirm: '确认'
        },
        statusMessages: {
          loadingConfig: '正在加载配置…',
          restoredDraft: ({ label }) => `已恢复 ${label} 的本地草稿`,
          refreshSuccess: ({ name }) => `${name} 已从远程刷新`,
          remoteUpdated: '远程快照已更新。高亮部分现在包含远程差异。',
          remoteUnchanged: '远程快照未发生变化。',
          refreshFailed: '刷新远程快照失败'
        },
        site: {
          addLanguage: '添加语言',
          removeLanguage: '移除',
          noLanguages: '尚未配置语言。',
          promptLanguage: '请输入语言代码（例如：en、zh、ja）：',
          languageExists: '该语言已经存在。',
          languageDefault: '默认',
          languageAutoOption: '自动检测（浏览器语言）',
          reset: '恢复默认',
          addLink: '添加链接',
          removeLink: '移除',
          noLinks: '暂无链接。',
          linkLabelPlaceholder: '名称',
          linkHrefPlaceholder: 'https://example.com',
          toggleEnabled: '启用',
          optionShow: '显示',
          optionHide: '隐藏',
          repoOwner: '仓库所有者',
          repoName: '仓库名称',
          repoBranch: '分支（可选）',
          sections: {
            identity: {
              title: '站点信息',
              description: '配置导航栏中展示的站点名称、标语和头像。'
            },
            seo: {
              title: 'SEO 与分享',
              description: '提供用于搜索引擎和链接预览的元信息。'
            },
            behavior: {
              title: '行为',
              description: '控制分页、默认打开的页面以及“全部文章”的显示。'
            },
            theme: {
              title: '主题',
              description: '设置访问者默认使用的主题方案。'
            },
            repo: {
              title: '仓库',
              description: '配置 GitHub 信息，以启用提交与“报告问题”链接。'
            },
            assets: {
              title: '资源提醒',
              description: '为体积较大的图片显示警告。'
            },
            extras: {
              title: '其他字段',
              description: '检测到但不可在此编辑的 site.yaml 字段。'
            }
          },
          fields: {
            siteTitle: '站点标题',
            siteTitleHelp: '显示在导航栏与页面元信息中。',
            siteSubtitle: '站点副标题',
            siteSubtitleHelp: '显示在导航栏标题下方。',
            avatar: '头像',
            avatarHelp: '头像图片的相对路径或完整 URL。',
            resourceURL: '资源 URL',
            resourceURLHelp: '指向已发布 wwwroot 目录的绝对地址（可选）。',
            contentRoot: '内容根目录',
            contentRootHelp: '存放 index.yaml 与 tabs.yaml 的文件夹。',
            siteDescription: '站点描述',
            siteDescriptionHelp: '用于 SEO 和分享链接的可选描述。',
            siteKeywords: '站点关键词',
            siteKeywordsHelp: '用于 SEO 的逗号分隔关键词（可选）。',
            profileLinks: '个人链接',
            profileLinksHelp: '显示在头像附近的个人或社交链接。',
            navLinks: '导航链接',
            navLinksHelp: '显示在导航菜单中的自定义链接。',
            defaultLanguage: '默认语言',
            defaultLanguageHelp: '当浏览器首选语言不匹配时使用的语言代码。',
            contentOutdatedDays: '过期提醒（天）',
            contentOutdatedDaysHelp: '文章超过此天数会标记为可能过期。留空则禁用。',
            pageSize: '每页文章数',
            pageSizeHelp: '“全部文章”页面每页最多显示的文章数量。',
            showAllPosts: '显示“全部文章”',
            showAllPostsHelp: '在导航中显示“全部文章”标签页。',
            landingTab: '默认标签页',
            landingTabHelp: '选择站点加载时首先打开的标签页。',
            landingTabAllPostsOption: '“全部文章”标签页',
            cardCoverFallback: '生成默认封面',
            cardCoverFallbackHelp: '当文章没有封面时生成一张替代封面。',
            errorOverlay: '错误浮层',
            errorOverlayHelp: '在发生运行时错误时显示调试浮层。',
            themeMode: '主题模式',
            themeModeHelp: '默认的主题模式（user / system / light / dark）。',
            themePack: '主题包',
            themePackHelp: '默认加载的主题包文件夹名称。',
            themeOverride: '锁定主题',
            themeOverrideHelp: '强制使用所选主题，忽略访问者的切换。',
            repo: 'GitHub 仓库',
            repoHelp: '用于提交、推送到 GitHub 以及“报告问题”链接。',
            assetLargeImage: '大图警告',
            assetLargeImageHelp: '当附件图片超过阈值时提醒编辑。',
            assetLargeImageThreshold: '大图阈值（KB）',
            assetLargeImageThresholdHelp: '触发警告的大小（千字节）。留空表示使用默认值。',
            extras: '保留字段',
            extrasHelp: '这些字段会保留在 site.yaml 中，需要手动编辑。'
          }
        },
        entryRow: {
          gripHint: '拖动以重新排序',
          details: '详情',
          delete: '删除'
        },
        languages: {
          count: ({ count }) => `${count} 种语言`,
          addVersion: '+ 版本',
          removeLanguage: '删除语言',
          addLanguage: '+ 添加语言',
          removedVersions: ({ versions }) => `已移除：${versions}`,
          placeholders: {
            indexPath: 'post/.../file.md',
            tabPath: 'tab/.../file.md'
          },
          fields: {
            title: '标题',
            location: '路径'
          },
          actions: {
            edit: '编辑',
            open: '在编辑器中打开',
            moveUp: '上移',
            moveDown: '下移',
            remove: '移除'
          }
        },
        entryKinds: {
          post: {
            label: '文章',
            confirm: '添加文章条目',
            placeholder: '文章键',
            message: '请输入新的文章键（仅限字母和数字）：'
          },
          tab: {
            label: '标签页',
            confirm: '添加标签页条目',
            placeholder: '标签页键',
            message: '请输入新的标签页键（仅限字母和数字）：'
          }
        },
        diff: {
          heading: '更改',
          title: ({ label }) => `更改 — ${label}`,
          close: '关闭',
          subtitle: {
            default: '查看与远程基线的差异。',
            overview: '查看未同步更改的摘要。',
            entries: '查看新增、删除和修改的条目。',
            order: '远程基线（左）· 当前顺序（右）'
          },
          tabs: {
            overview: '概览',
            entries: '条目',
            order: '顺序'
          },
          order: {
            remoteTitle: '远程',
            currentTitle: '当前',
            empty: '暂无可比较的条目。',
            inlineAllNew: '当前所有条目相较基线均为新增内容。',
            emptyKey: '（空）',
            badges: {
              to: ({ index }) => `→ #${index}`,
              from: ({ index }) => `来自 #${index}`,
              removed: '已移除',
              added: '新条目'
            }
          },
          orderStats: {
            empty: '无直接移动；更改来自新增或删除',
            moved: ({ count }) => `移动 ${count}`,
            added: ({ count }) => `+${count} 新增`,
            removed: ({ count }) => `-${count} 已移除`
          },
          lists: {
            more: ({ count }) => `+${count} 更多`
          },
          inlineChips: {
            added: ({ count }) => `+${count} 新增`,
            removed: ({ count }) => `-${count} 已移除`,
            modified: ({ count }) => `~${count} 已修改`,
            orderChanged: '顺序已更改',
            orderParts: {
              moved: ({ count }) => `${count} 项移动`,
              added: ({ count }) => `+${count} 新增`,
              removed: ({ count }) => `-${count} 已移除`
            },
            orderSummary: ({ parts }) => `顺序：${parts}`,
            langs: ({ summary }) => `语言：${summary}`,
            none: '检测到更改。'
          },
          inline: {
            title: '更改摘要',
            ariaOrder: ({ label }) => `${label} 的旧顺序`,
            openAria: ({ label }) => `打开 ${label} 的更改概览`
          },
          overview: {
            empty: '该文件没有检测到更改。',
            stats: {
              added: '新增',
              removed: '已移除',
              modified: '已修改',
              order: '顺序',
              changed: '已更改',
              unchanged: '未更改'
            },
            blocks: {
              added: '新增条目',
              removed: '已移除的条目',
              modified: '已修改的条目'
            },
            languagesImpacted: ({ languages }) => `受影响的语言：${languages}`
          },
          entries: {
            noLanguageContent: '未记录任何语言内容。',
            snapshot: {
              indexValue: ({ count }) => `${count} 个值`,
              emptyEntry: '空条目',
              tabTitle: ({ title }) => `标题 “${title}”`,
              tabLocation: ({ location }) => `位置 ${location}`
            },
            summary: ({ lang, summary }) => `${lang}：${summary}`,
            state: {
              added: ({ lang }) => `${lang}：已新增`,
              removed: ({ lang }) => `${lang}：已移除`,
              updatedFields: ({ lang, fields }) => `${lang}：已更新 ${fields}`
            },
            parts: {
              typeChanged: '类型已更改',
              addedCount: ({ count }) => `+${count} 新增`,
              removedCount: ({ count }) => `-${count} 已移除`,
              updatedCount: ({ count }) => `${count} 项已更新`,
              reordered: '顺序已调整',
              contentUpdated: '内容已更新'
            },
            join: {
              comma: '、',
              and: ' 和 '
            },
            fields: {
              title: '标题',
              location: '位置',
              content: '内容'
            },
            empty: '没有检测到内容差异。',
            sections: {
              added: '新增条目',
              removed: '已移除的条目',
              modified: '已修改的条目'
            },
            orderOnly: '该文件仅更改了顺序。'
          }
        },
        github: {
          modal: {
            title: '与 GitHub 同步',
            subtitle: '请提供具备仓库内容访问权限的精细化个人访问令牌。',
            summaryTitle: '将提交以下文件：',
            tokenLabel: '精细化个人访问令牌',
            helpHtml: '请在 <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">github.com/settings/tokens</a> 创建一个具有仓库内容访问权限的令牌。该令牌仅在当前浏览器会话中存储。',
            forget: '忘记令牌',
            submit: '提交更改',
            errorRequired: '请输入精细化个人访问令牌以继续。'
          }
        },
        dialogs: {
          cancel: '取消',
          confirm: '确认'
        },
        addEntryPrompt: {
          hint: '仅使用英文字母和数字。',
          confirm: '添加条目',
          defaultType: '条目',
          placeholder: '条目键名',
          message: ({ label }) => `请输入新的 ${label} 键名：`,
          errorEmpty: '键名不能为空。',
          errorInvalid: '键名只能包含英文字母、数字、下划线或连字符。',
          errorDuplicate: '该键名已存在，请使用其他键名。'
        },
        discardConfirm: {
          messageReload: ({ label }) => `丢弃 ${label} 的本地更改并重新加载远程文件？此操作无法撤销。`,
          messageSimple: ({ label }) => `丢弃 ${label} 的本地更改？此操作无法撤销。`,
          closeTabMessage: ({ label }) => `关闭 ${label}？关闭此标签页将放弃本地 Markdown 更改。`,
          closeTabFallback: '此标签页',
          discard: '丢弃',
          discarding: '正在丢弃…',
          successFresh: ({ label }) => `已丢弃本地更改；已加载最新的 ${label}`,
          successCached: ({ label }) => `已丢弃本地更改；已从缓存快照恢复 ${label}`,
          failed: '丢弃本地更改失败。'
        },
        markdown: {
          push: {
            labelDefault: '同步',
            labelCreate: '在 GitHub 上创建',
            labelUpdate: '同步',
            tooltips: {
              default: '复制草稿到 GitHub。',
              noRepo: '请在 site.yaml 中配置仓库以启用 GitHub 推送。',
              noFile: '请先打开一个 Markdown 文件以启用 GitHub 推送。',
              error: '推送前请先解决文件加载错误。',
              checking: '正在检查远程版本…',
              loading: '正在加载远程快照…',
              create: '复制草稿并在 GitHub 上创建该文件。',
              update: '复制草稿并在 GitHub 上更新该文件。'
            }
          },
          discard: {
            label: '丢弃',
            busy: '正在丢弃…',
            tooltips: {
              default: '丢弃本地 Markdown 更改并恢复上次加载的版本。',
              noFile: '请先打开一个 Markdown 文件再丢弃本地更改。',
              reload: '丢弃本地 Markdown 更改（将重新加载远程快照）。'
            }
          },
          draftIndicator: {
            conflict: '本地草稿与远程文件存在冲突。',
            dirty: '编辑器中有未保存的更改。',
            saved: '本地草稿已保存在浏览器中。'
          },
          currentFile: '当前文件',
          fileFallback: 'Markdown 文件',
          openBeforeEditor: '请输入 Markdown 路径后再打开编辑器。',
          toastCopiedCreate: '已复制 Markdown。GitHub 将打开以创建该文件。',
          toastCopiedUpdate: '已复制 Markdown。GitHub 将打开以更新该文件。',
          blockedCreate: '已复制 Markdown。如未打开新标签页，请点击“打开 GitHub”以创建该文件。',
          blockedUpdate: '已复制 Markdown。如未打开新标签页，请点击“打开 GitHub”以更新该文件。'
        },
        yaml: {
          toastCopiedUpdate: ({ name }) => `已复制 ${name}。GitHub 将打开以粘贴更新。`,
          toastCopiedCreate: ({ name }) => `已复制 ${name}。GitHub 将打开以创建该文件。`,
          blocked: ({ name }) => `已复制 ${name}。如未打开新标签页，请点击“打开 GitHub”。`
        },
        remoteWatcher: {
          waitingForCreate: ({ label }) => `正在等待 GitHub 创建 ${label}`,
          waitingForUpdate: ({ label }) => `正在等待 GitHub 更新 ${label}`,
          waitingForCommitStatus: '正在等待 GitHub 提交…',
          checkingRemoteChanges: '正在检查远程更改…',
          waitingForCommit: '正在等待提交…',
          stopWaiting: '停止等待',
          waitingForRemoteResponse: '正在等待远程响应…',
          remoteCheckFailedRetry: '远程检查失败，正在重试…',
          remoteFileNotFoundYet: '远程文件尚未找到…',
          remoteFileStillMissing: '远程文件仍缺失…',
          updateDetectedRefreshing: '检测到更新，正在刷新…',
          remoteFileDiffersWaiting: '远程文件内容与本地仍不一致，继续等待…',
          remoteFileExistsDiffersWaiting: '远程文件已存在但内容不同，继续等待…',
          mismatchAdvice: '如果你的 GitHub 提交确实不同，请取消并使用“刷新”查看。',
          remoteCheckCanceled: '远程检查已取消',
          errorWithDetail: ({ message }) => `错误：${message}`,
          networkError: '网络错误',
          fileNotFoundOnServer: '服务器上未找到文件',
          remoteSnapshotUpdated: '远程快照已更新',
          waitingForGitHub: '正在等待 GitHub…',
          preparing: '正在准备…',
          waitingForLabel: ({ label }) => `正在等待 ${label} 在 GitHub 上更新…`,
          waitingForRemote: '正在等待远程…',
          yamlNotFoundYet: ({ label }) => `${label} 在远程尚未找到…`,
          remoteYamlDiffersWaiting: '远程 YAML 与本地快照仍不一致，继续等待…',
          remoteYamlExistsDiffersWaiting: '远程 YAML 已更新但内容不同，继续等待…',
          yamlMismatchAdvice: '如果提交与草稿不同，请取消并点击“刷新”以拉取。'
        },
      },
      github: {
        status: {
          arrowWarn: '检查仓库',
          arrowDefault: '状态',
          loadingRepo: '正在加载 GitHub 设置…',
          readingConfig: '正在读取 site.yaml 中的 GitHub 连接配置…',
          repoNotConfigured: '尚未配置 GitHub 仓库',
          repoConfigHint: '请在 site.yaml 中配置 repo.owner 和 repo.name，以启用草稿推送。',
          checkingRepo: '正在检查仓库访问权限…',
          rateLimited: '已触发 GitHub 速率限制，请稍后再试。',
          repoNotFound: '在 GitHub 上未找到该仓库。',
          networkError: '无法连接到 GitHub，请检查网络。',
          repoCheckFailed: '仓库检查失败。',
          repoConnectedDefault: ({ branch }) => `仓库已连接 · 默认分支“${branch}”`,
          checkingBranch: '正在检查分支访问权限…',
          branchNotFound: '在 GitHub 上未找到该分支。',
          branchCheckFailed: '分支检查失败。',
          repoConnected: '仓库已连接',
          configUnavailable: '无法获取 GitHub 配置',
          readFailed: '读取 site.yaml 失败。'
        }
      },
      footerNote: '由 ❤️ 打造，基于 <a href="https://deemoe404.github.io/NanoSite/" target="_blank" rel="noopener">NanoSite</a>。保持灵感，持续创作。'
    },
  },
  ja: {
    ui: {
      allPosts: 'すべての記事',
      searchTab: '検索',
      postTab: '記事',
      prev: '前へ',
      next: '次へ',
      contents: '目次',
      loading: '読み込み中…',
      top: 'トップ',
      minRead: '分で読めます',
      close: '閉じる',
      copyLink: 'リンクをコピー',
      linkCopied: 'リンクをコピーしました',
      versionLabel: 'バージョン',
      versionsCount: (n) => `${n} 個のバージョン`,
      latestSuffix: '（最新）',
      outdatedWarning: '注意：公開から時間が経っているため、内容が古くなっている可能性があります。',
      notFound: '見つかりません',
      pageUnavailable: 'ページを表示できません',
      indexUnavailable: 'インデックスを読み込めません',
      backToAllPosts: 'すべての記事へ戻る',
      backToHome: 'ホームに戻る',
      noResultsTitle: '結果なし',
      noResultsBody: (q) => `「${q}」に一致する記事は見つかりませんでした。`,
      tags: 'タグ',
      tagSearch: (tag) => `タグ: ${tag}`,
      allTags: 'すべてのタグ',
      more: 'もっと見る',
      less: '折りたたむ',
      details: '詳細',
      copyDetails: '詳細をコピー',
      reportIssue: '問題を報告',
      warning: '警告',
      error: 'エラー',
      aiFlagLabel: 'AI 参加',
      aiFlagTooltip: 'AI 参加：本記事は生成系LLMで生成・編集されています',
      draftBadge: '下書き',
      draftNotice: 'この記事は執筆中・編集中です。内容は変更される場合があります。'
    },
    code: {
      copy: 'コピー',
      copied: 'コピーしました',
      failed: 'コピー失敗',
      copyAria: 'コードをコピー'
    },
    errors: {
      postNotFoundTitle: '記事が見つかりません',
      postNotFoundBody: '要求された記事を読み込めませんでした。',
      pageUnavailableTitle: 'ページを表示できません',
      pageUnavailableBody: 'このページを読み込めませんでした。',
      indexUnavailableBody: '記事インデックスを読み込めませんでした。ネットワークやリポジトリ内容を確認してください。'
    },
    sidebar: {
      searchPlaceholder: '記事を検索…',
      siteTitle: 'Phyllali のブログ',
      siteSubtitle: 'ゲームを遊んでくれてありがとう。',
      socialGithub: 'GitHub'
    },
    tools: {
      sectionTitle: 'ツール',
      toggleTheme: 'テーマ切替',
      postEditor: '記事エディター',
      themePack: 'テーマパック',
      language: '言語',
      resetLanguage: '言語をリセット',
      seoGenerator: 'SEOジェネレーター'
    },
    toc: {
      toggleAria: 'セクションの切替',
      copied: 'コピーしました！'
    },
    titles: {
      allPosts: 'すべての記事',
      search: (q) => `検索: ${q}`
    },
    editor: {
      pageTitle: 'Markdown エディター - NanoSite',
      languageLabel: '言語',
      verifying: '検証中…',
      verify: '検証',
      nav: {
        modeSwitchAria: 'モード切り替え',
        dynamicTabsAria: 'エディタータブを開く'
      },
      modes: {
        composer: 'コンポーザー',
        editor: 'エディター'
      },
      status: {
        localLabel: 'ローカル',
        checkingDrafts: '下書きを確認中…',
        synced: '同期済み',
        upload: 'アップロード',
        remoteLabel: 'GitHub',
        loadingRepo: 'GitHub 設定を読み込み中…',
        checkingConnection: '接続を確認中…',
        clean: 'ローカルの変更はありません'
      },
      currentFile: {
        status: {
          checking: 'ファイルを確認しています…',
          existing: '既存のファイル',
          missing: '新しいファイル',
          error: 'ファイルを読み込めませんでした'
        },
        meta: {
          checking: '確認中…',
          checkingStarted: ({ time }) => `確認中…（開始: ${time}）`,
          lastChecked: ({ time }) => `最終確認: ${time}`
        },
        draft: {
          justNow: 'たった今',
          savedHtml: ({ time }) => `ローカル下書きを${time}に保存しました`,
          saved: 'ローカル下書きを保存しました',
          savedConflictHtml: ({ time }) => `ローカル下書きを${time}に保存しました（リモート更新あり）`,
          conflict: 'ローカル下書き（リモート更新あり）',
          available: 'ローカル下書きが利用可能です'
        }
      },
      toolbar: {
        wrap: '折り返し:',
        wrapOn: 'オン',
        wrapOff: 'オフ',
        view: '表示:',
        viewEdit: '編集',
        viewPreview: 'プレビュー',
        discard: '破棄',
        wrapAria: '折り返し設定',
        viewAria: '表示の切り替え'
      },
      toast: {
        openAction: '開く',
        closeAria: '通知を閉じる'
      },
      toasts: {
        remoteMarkdownMismatch: 'リモートの Markdown がローカルの下書きと異なります。続行する前に差分を確認してください。',
        markdownSynced: 'Markdown を GitHub と同期しました。',
        remoteCheckCanceledUseRefresh: 'リモートチェックをキャンセルしました。コミットの準備ができたら「更新」をクリックしてください。',
        yamlParseFailed: ({ label }) => `${label} を取得しましたが、YAML を解析できませんでした。`,
        yamlUpdatedDifferently: ({ label }) => `${label} は GitHub 上で異なる更新が行われています。ハイライトされた差分を確認してください。`,
        yamlSynced: ({ label }) => `${label} を GitHub と同期しました。`,
        remoteCheckCanceledClickRefresh: 'リモートチェックをキャンセルしました。コミットの準備ができたら「更新」をクリックしてください。',
        popupBlocked: 'ブラウザが GitHub ウィンドウをブロックしました。このサイトのポップアップを許可してから再試行してください。',
        openGithubAction: 'GitHub を開く',
        markdownOpenBeforeInsert: '画像を挿入する前に Markdown ファイルを開いてください。',
        assetAttached: ({ label }) => `${label} を添付しました`,
        noPendingChanges: 'コミットする変更はありません。',
        siteWaitStopped: 'ライブサイトの更新待機を停止しました。コミットは GitHub にありますが、反映まで数分かかる場合があります。',
        siteWaitTimedOut: 'GitHub にファイルをコミットしましたが、ライブサイトが時間内に更新されませんでした。デプロイ状況を手動で確認してください。',
        commitSuccess: ({ count }) => `${count} 件のファイルを GitHub にコミットしました。`,
        githubCommitFailed: 'GitHub へのコミットに失敗しました。',
        githubTokenRejected: 'GitHub がアクセストークンを拒否しました。新しい細分化されたパーソナルアクセストークンを入力してください。',
        repoOwnerMissing: 'GitHub 同期を有効にするには site.yaml の repo.owner と repo.name を設定してください。',
        markdownOpenBeforePush: 'GitHub にプッシュする前に Markdown ファイルを開いてください。',
        repoConfigMissing: 'GitHub プッシュを有効にするには site.yaml にリポジトリ情報を設定してください。',
        invalidMarkdownPath: '無効な Markdown パスです。',
        unableLoadLatestMarkdown: 'プッシュ前に最新の Markdown を読み込めませんでした。',
        markdownNotReady: 'Markdown ファイルはまだプッシュできる状態ではありません。',
        unableResolveGithubFile: 'このファイルの GitHub URL を解決できません。',
        markdownOpenBeforeDiscard: 'ローカル変更を破棄する前に Markdown ファイルを開いてください。',
        noLocalMarkdownChanges: '破棄できる Markdown のローカル変更はありません。',
        discardSuccess: ({ label }) => `${label} のローカル変更を破棄しました。`,
        discardFailed: 'Markdown のローカル変更を破棄できませんでした。',
        unableResolveYamlSync: 'YAML 同期用の GitHub URL を解決できません。',
        yamlUpToDate: ({ name }) => `${name} は最新です。`,
        yamlCopiedNoRepo: 'YAML をコピーしました。GitHub を開くには site.yaml でリポジトリを設定してください。'
      },
      editorTools: {
        aria: 'エディターのツール',
        formatGroupAria: '書式ショートカット',
        bold: '太字',
        italic: '斜体',
        strike: '取り消し線',
        heading: '見出し',
        quote: '引用',
        code: 'インラインコード',
        codeBlock: 'コードブロック',
        articleCard: '記事カード',
        insertCardTitle: '記事カードを挿入',
        insertImage: '画像を挿入',
        cardDialogAria: '記事カードを挿入',
        cardSearch: '記事を検索…',
        cardEmpty: '該当する記事はありません',
        hints: {
          bold: 'テキストが選択されていません。先にテキストを選択してから「太字」をクリックし、** ** で囲んでください。',
          italic: 'テキストが選択されていません。先にテキストを選択してから「斜体」をクリックし、* * で囲んでください。',
          strike: 'テキストが選択されていません。先にテキストを選択してから「取り消し線」をクリックし、~~ ~~ で囲んでください。',
          heading: '行を選択するか、キャレットを空行に置いてから「見出し」をクリックし、先頭に「# 」を追加します。',
          quote: '行を選択するか、キャレットを空行に置いてから「引用」をクリックし、先頭に「> 」を追加します。',
          code: 'テキストが選択されていません。先にテキストを選択してから「コード」をクリックし、バッククォートで囲んでください。',
          codeBlock: '行を選択するか、キャレットを空行に置いてから「コードブロック」をクリックし、``` で囲みます。',
          insertCard: 'キャレットを空行に置いてからクリックして記事カードを挿入します。記事が表示されない場合は、インデックスの読み込みを待つか index.yaml に項目を追加してください。'
        }
      },
      editorPlaceholder: '# こんにちは、NanoSite\n\nMarkdown の入力を始めましょう…',
      editorTextareaAria: 'Markdown ソース',
      empty: {
        title: '現在開いているエディターはありません',
        body: 'コンポーザーから Markdown を開いて編集を開始してください。'
      },
      composer: {
        fileSwitchAria: 'ファイル切り替え',
        fileLabel: 'ファイル:',
        fileArticles: '記事',
        filePages: 'ページ',
        fileSite: 'サイト',
        addPost: '記事エントリーを追加',
        addTab: 'タブ項目を追加',
        refresh: '更新',
        refreshTitle: '最新のリモートスナップショットを取得',
        refreshing: '更新中…',
        discard: '破棄',
        discardTitle: 'ローカルの下書きを破棄してリモートを再読み込み',
        changeSummary: '変更の概要',
        reviewChanges: '変更を確認',
        inlineEmpty: '比較できるエントリーはまだありません。',
        indexInlineAria: 'index.yaml の旧順序',
        indexEditorAria: 'index.yaml エディター',
        tabsInlineAria: 'tabs.yaml の旧順序',
        tabsEditorAria: 'tabs.yaml エディター',
        siteEditorAria: 'site.yaml エディター',
        noLocalChangesToCommit: 'コミットするローカルの変更はありません。',
        noLocalChangesYet: 'ローカルの変更はまだありません。',
        dialogs: {
          cancel: 'キャンセル',
          confirm: '確認'
        },
        statusMessages: {
          loadingConfig: '設定を読み込み中…',
          restoredDraft: ({ label }) => `${label} のローカル下書きを復元しました`,
          refreshSuccess: ({ name }) => `${name} をリモートから更新しました`,
          remoteUpdated: 'リモートスナップショットが更新されました。ハイライトにリモートの差分が含まれます。',
          remoteUnchanged: 'リモートスナップショットは変更されていません。',
          refreshFailed: 'リモートスナップショットの更新に失敗しました'
        },
        site: {
          addLanguage: '言語を追加',
          removeLanguage: '削除',
          noLanguages: '言語はまだ設定されていません。',
          promptLanguage: '言語コードを入力してください（例: en, zh, ja）：',
          languageExists: 'その言語はすでに存在します。',
          languageDefault: 'デフォルト',
          languageAutoOption: '自動検出（ブラウザー言語）',
          reset: '上書きをリセット',
          addLink: 'リンクを追加',
          removeLink: '削除',
          noLinks: 'リンクはまだありません。',
          linkLabelPlaceholder: 'ラベル',
          linkHrefPlaceholder: 'https://example.com',
          toggleEnabled: '有効にする',
          optionShow: '表示する',
          optionHide: '非表示にする',
          repoOwner: 'リポジトリ所有者',
          repoName: 'リポジトリ名',
          repoBranch: 'ブランチ（任意）',
          sections: {
            identity: {
              title: 'サイト情報',
              description: 'ナビゲーションに表示されるサイト名・サブタイトル・アバターを設定します。'
            },
            seo: {
              title: 'SEO / 共有',
              description: '検索エンジンやリンクプレビューで利用されるメタ情報を設定します。'
            },
            behavior: {
              title: '動作',
              description: 'ページネーション、初期表示タブ、All Posts の表示を制御します。'
            },
            theme: {
              title: 'テーマ',
              description: '訪問者に適用される既定のテーマ設定です。'
            },
            repo: {
              title: 'リポジトリ',
              description: 'GitHub へのコミットや「問題を報告」リンクに必要な情報です。'
            },
            assets: {
              title: 'アセット警告',
              description: '大きな画像を挿入するときの警告を設定します。'
            },
            extras: {
              title: 'その他のキー',
              description: 'site.yaml に存在するものの、この画面では編集できないキーです。'
            }
          },
          fields: {
            siteTitle: 'サイトタイトル',
            siteTitleHelp: 'ナビゲーションとメタ情報に表示されます。',
            siteSubtitle: 'サイトサブタイトル',
            siteSubtitleHelp: 'ナビゲーションのタイトル下に表示されます。',
            avatar: 'アバター',
            avatarHelp: 'アバター画像への相対パスまたは URL。',
            resourceURL: 'リソース URL',
            resourceURLHelp: '公開済み wwwroot フォルダーへの絶対 URL（任意）。',
            contentRoot: 'コンテンツルート',
            contentRootHelp: 'index.yaml と tabs.yaml を配置しているフォルダー。',
            siteDescription: 'サイト説明',
            siteDescriptionHelp: 'SEO やリンクプレビュー用の任意の説明文。',
            siteKeywords: 'サイトキーワード',
            siteKeywordsHelp: 'SEO 用のカンマ区切りキーワード（任意）。',
            profileLinks: 'プロフィールリンク',
            profileLinksHelp: 'アバター付近に表示されるプロフィール / ソーシャルリンク。',
            navLinks: 'ナビゲーションリンク',
            navLinksHelp: 'ナビゲーションメニューに表示するカスタムリンク。',
            defaultLanguage: '既定の言語',
            defaultLanguageHelp: 'ブラウザー設定が一致しない場合に使用する言語コード。',
            contentOutdatedDays: '古い記事のしきい値（日）',
            contentOutdatedDaysHelp: '指定日数を超えた記事を古い可能性ありとして表示します。空欄で無効。',
            pageSize: '1 ページの投稿数',
            pageSizeHelp: 'All Posts ページに表示する最大投稿数。',
            showAllPosts: 'All Posts タブ',
            showAllPostsHelp: 'ナビゲーションに All Posts タブを表示します。',
            landingTab: '初期表示タブ',
            landingTabHelp: 'サイト読み込み時に最初に開くタブを選択します。',
            landingTabAllPostsOption: 'All Posts タブ',
            cardCoverFallback: 'カードの代替カバー',
            cardCoverFallbackHelp: '投稿にカバー画像がない場合に自動生成します。',
            errorOverlay: 'エラーオーバーレイ',
            errorOverlayHelp: '実行時エラーが起きたときにオーバーレイを表示します。',
            themeMode: 'テーマモード',
            themeModeHelp: '既定のテーマモード（user / system / light / dark）。',
            themePack: 'テーマパック',
            themePackHelp: '既定で読み込むテーマパックフォルダー名。',
            themeOverride: 'テーマを固定する',
            themeOverrideHelp: '訪問者が変更しても選択したテーマを強制します。',
            repo: 'GitHub リポジトリ',
            repoHelp: 'コミット、GitHub へのプッシュ、問題報告リンクに必要です。',
            assetLargeImage: '大きな画像の警告',
            assetLargeImageHelp: '添付画像がしきい値を超えた際に警告します。',
            assetLargeImageThreshold: '画像のしきい値 (KB)',
            assetLargeImageThresholdHelp: '警告を表示するサイズ（KB）。空欄で既定値を使用。',
            extras: '保持しているキー',
            extrasHelp: 'site.yaml に残しつつ、ここでは編集できないキーです。'
          }
        },
        entryRow: {
          gripHint: 'ドラッグして並び替え',
          details: '詳細',
          delete: '削除'
        },
        languages: {
          count: ({ count }) => `${count} 言語`,
          addVersion: '+ バージョン',
          removeLanguage: '言語を削除',
          addLanguage: '+ 言語を追加',
          removedVersions: ({ versions }) => `削除済み: ${versions}`,
          placeholders: {
            indexPath: 'post/.../file.md',
            tabPath: 'tab/.../file.md'
          },
          fields: {
            title: 'タイトル',
            location: '場所'
          },
          actions: {
            edit: '編集',
            open: 'エディターで開く',
            moveUp: '上へ移動',
            moveDown: '下へ移動',
            remove: '削除'
          }
        },
        entryKinds: {
          post: {
            label: '投稿',
            confirm: '投稿エントリを追加',
            placeholder: '投稿キー',
            message: '新しい投稿キーを入力してください（英数字のみ）：'
          },
          tab: {
            label: 'タブ',
            confirm: 'タブエントリを追加',
            placeholder: 'タブキー',
            message: '新しいタブキーを入力してください（英数字のみ）：'
          }
        },
        diff: {
          heading: '変更',
          title: ({ label }) => `変更 — ${label}`,
          close: '閉じる',
          subtitle: {
            default: 'リモートのベースラインとの差分を確認します。',
            overview: '未同期の変更内容をざっと確認します。',
            entries: '追加・削除・変更されたエントリを確認します。',
            order: 'リモートの基準（左）・現在の順序（右）'
          },
          tabs: {
            overview: '概要',
            entries: 'エントリ',
            order: '順序'
          },
          order: {
            remoteTitle: 'リモート',
            currentTitle: '現在',
            empty: '比較できる項目がありません。',
            inlineAllNew: '現在の項目はすべて基準と比べて新規のものです。',
            emptyKey: '（空）',
            badges: {
              to: ({ index }) => `→ #${index}`,
              from: ({ index }) => `#${index} から`,
              removed: '削除済み',
              added: '新規'
            }
          },
          orderStats: {
            empty: '直接の移動はありません（追加または削除による変更）',
            moved: ({ count }) => `${count} 件移動`,
            added: ({ count }) => `+${count} 件追加`,
            removed: ({ count }) => `-${count} 件削除`
          },
          lists: {
            more: ({ count }) => `他 ${count} 件`
          },
          inlineChips: {
            added: ({ count }) => `+${count} 件追加`,
            removed: ({ count }) => `-${count} 件削除`,
            modified: ({ count }) => `~${count} 件変更`,
            orderChanged: '順序が変更されました',
            orderParts: {
              moved: ({ count }) => `${count} 件移動`,
              added: ({ count }) => `+${count} 件追加`,
              removed: ({ count }) => `-${count} 件削除`
            },
            orderSummary: ({ parts }) => `順序: ${parts}`,
            langs: ({ summary }) => `言語: ${summary}`,
            none: '変更が検出されました。'
          },
          inline: {
            title: '変更サマリー',
            ariaOrder: ({ label }) => `${label} の旧順序`,
            openAria: ({ label }) => `${label} の変更概要を開く`
          },
          overview: {
            empty: 'このファイルには変更が見つかりませんでした。',
            stats: {
              added: '追加',
              removed: '削除',
              modified: '変更',
              order: '順序',
              changed: '変更あり',
              unchanged: '変更なし'
            },
            blocks: {
              added: '追加されたエントリ',
              removed: '削除されたエントリ',
              modified: '変更されたエントリ'
            },
            languagesImpacted: ({ languages }) => `影響を受けた言語: ${languages}`
          },
          entries: {
            noLanguageContent: '言語別の内容は記録されていません。',
            snapshot: {
              indexValue: ({ count }) => `${count} 件の値`,
              emptyEntry: '空のエントリ',
              tabTitle: ({ title }) => `タイトル「${title}」`,
              tabLocation: ({ location }) => `場所 ${location}`
            },
            summary: ({ lang, summary }) => `${lang}: ${summary}`,
            state: {
              added: ({ lang }) => `${lang}: 追加済み`,
              removed: ({ lang }) => `${lang}: 削除済み`,
              updatedFields: ({ lang, fields }) => `${lang}: ${fields} を更新`
            },
            parts: {
              typeChanged: '種類が変更されました',
              addedCount: ({ count }) => `+${count} 件追加`,
              removedCount: ({ count }) => `-${count} 件削除`,
              updatedCount: ({ count }) => `${count} 件更新`,
              reordered: '並び替え済み',
              contentUpdated: '内容を更新'
            },
            join: {
              comma: '、',
              and: ' と '
            },
            fields: {
              title: 'タイトル',
              location: '場所',
              content: '内容'
            },
            empty: '内容の差分は見つかりませんでした。',
            sections: {
              added: '追加されたエントリ',
              removed: '削除されたエントリ',
              modified: '変更されたエントリ'
            },
            orderOnly: 'このファイルでは順序のみが変更されました。'
          }
        },
        github: {
          modal: {
            title: 'GitHub と同期',
            subtitle: 'リポジトリの内容にアクセスできるファイングレインド Personal Access Token を入力してください。',
            summaryTitle: '以下のファイルがコミットされます:',
            tokenLabel: 'ファイングレインド Personal Access Token',
            helpHtml: '<a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">github.com/settings/tokens</a> でリポジトリ内容にアクセスできるトークンを作成してください。このトークンはこのブラウザセッションにのみ保存されます。',
            forget: 'トークンを削除',
            submit: '変更をコミット',
            errorRequired: '続行するにはファイングレインド Personal Access Token を入力してください。'
          }
        },
        dialogs: {
          cancel: 'キャンセル',
          confirm: '確認'
        },
        addEntryPrompt: {
          hint: '英数字のみを使用してください。',
          confirm: 'エントリーを追加',
          defaultType: 'エントリー',
          placeholder: 'エントリーキー',
          message: ({ label }) => `新しい ${label} のキーを入力してください：`,
          errorEmpty: 'キーは必須です。',
          errorInvalid: 'キーには英数字、アンダースコア、ハイフンのみ使用できます。',
          errorDuplicate: 'そのキーは既に存在します。別のキーを選んでください。'
        },
        discardConfirm: {
          messageReload: ({ label }) => `${label} のローカル変更を破棄してリモートファイルを再読み込みしますか？この操作は取り消せません。`,
          messageSimple: ({ label }) => `${label} のローカル変更を破棄しますか？この操作は取り消せません。`,
          closeTabMessage: ({ label }) => `${label} を閉じますか？このタブを閉じるとローカルの Markdown 変更が失われます。`,
          closeTabFallback: 'このタブ',
          discard: '破棄',
          discarding: '破棄中…',
          successFresh: ({ label }) => `ローカル変更を破棄し、最新の ${label} を読み込みました`,
          successCached: ({ label }) => `ローカル変更を破棄し、キャッシュの ${label} を復元しました`,
          failed: 'ローカル変更を破棄できませんでした。'
        },
        markdown: {
          push: {
            labelDefault: '同期',
            labelCreate: 'GitHub で作成',
            labelUpdate: '同期',
            tooltips: {
              default: 'ドラフトを GitHub にコピーします。',
              noRepo: 'GitHub プッシュを有効にするには site.yaml でリポジトリを設定してください。',
              noFile: 'GitHub にプッシュする前に Markdown ファイルを開いてください。',
              error: 'プッシュする前にファイル読み込みエラーを解決してください。',
              checking: 'リモート版を確認中…',
              loading: 'リモートスナップショットを読み込み中…',
              create: 'ドラフトをコピーして GitHub でこのファイルを作成します。',
              update: 'ドラフトをコピーして GitHub でこのファイルを更新します。'
            }
          },
          discard: {
            label: '破棄',
            busy: '破棄中…',
            tooltips: {
              default: 'Markdown のローカル変更を破棄し、最後に読み込んだ版を復元します。',
              noFile: 'ローカル変更を破棄する前に Markdown ファイルを開いてください。',
              reload: 'Markdown のローカル変更を破棄し（リモートスナップショットを再読み込みします）。'
            }
          },
          draftIndicator: {
            conflict: 'ローカルの下書きがリモートファイルと競合しています。',
            dirty: 'エディターに未保存の変更があります。',
            saved: 'ローカルの下書きはブラウザーに保存されています。'
          },
          currentFile: '現在のファイル',
          fileFallback: 'Markdown ファイル',
          openBeforeEditor: 'エディターを開く前に Markdown の場所を入力してください。',
          toastCopiedCreate: 'Markdown をコピーしました。GitHub が開いてこのファイルを作成します。',
          toastCopiedUpdate: 'Markdown をコピーしました。GitHub が開いてこのファイルを更新します。',
          blockedCreate: 'Markdown をコピーしました。新しいタブが表示されない場合は「GitHub を開く」をクリックして作成してください。',
          blockedUpdate: 'Markdown をコピーしました。新しいタブが表示されない場合は「GitHub を開く」をクリックして更新してください。'
        },
        yaml: {
          toastCopiedUpdate: ({ name }) => `${name} をコピーしました。GitHub が開いて更新内容を貼り付けられます。`,
          toastCopiedCreate: ({ name }) => `${name} をコピーしました。GitHub が開いてファイルを作成できます。`,
          blocked: ({ name }) => `${name} をコピーしました。新しいタブが表示されない場合は「GitHub を開く」をクリックしてください。`
        },
        remoteWatcher: {
          waitingForCreate: ({ label }) => `GitHub で ${label} が作成されるのを待機しています`,
          waitingForUpdate: ({ label }) => `GitHub で ${label} が更新されるのを待機しています`,
          waitingForCommitStatus: 'GitHub のコミットを待機中…',
          checkingRemoteChanges: 'リモートの変更を確認中…',
          waitingForCommit: 'コミットを待機中…',
          stopWaiting: '待機を停止',
          waitingForRemoteResponse: 'リモートの応答を待機しています…',
          remoteCheckFailedRetry: 'リモートチェックに失敗しました。再試行します…',
          remoteFileNotFoundYet: 'リモートファイルがまだ見つかりません…',
          remoteFileStillMissing: 'リモートファイルがまだ存在しません…',
          updateDetectedRefreshing: '更新を検出しました。再読み込みしています…',
          remoteFileDiffersWaiting: 'リモートファイルがローカル内容とまだ一致しません。待機中…',
          remoteFileExistsDiffersWaiting: 'リモートファイルは存在しますが内容が異なります。待機中…',
          mismatchAdvice: 'GitHub のコミットが意図的に異なる場合はキャンセルし、「更新」で内容を確認してください。',
          remoteCheckCanceled: 'リモートチェックをキャンセルしました',
          errorWithDetail: ({ message }) => `エラー: ${message}`,
          networkError: 'ネットワークエラー',
          fileNotFoundOnServer: 'サーバーでファイルが見つかりません',
          remoteSnapshotUpdated: 'リモートスナップショットを更新しました',
          waitingForGitHub: 'GitHub を待機中…',
          preparing: '準備中…',
          waitingForLabel: ({ label }) => `GitHub で ${label} の更新を待機しています…`,
          waitingForRemote: 'リモートを待機中…',
          yamlNotFoundYet: ({ label }) => `リモートで ${label} がまだ見つかりません…`,
          remoteYamlDiffersWaiting: 'リモート YAML がローカルのスナップショットとまだ一致しません。待機中…',
          remoteYamlExistsDiffersWaiting: 'リモート YAML は更新されていますが内容が異なります。待機中…',
          yamlMismatchAdvice: 'コミット内容が下書きと異なる場合はキャンセルし、「更新」をクリックして取得してください。'
        },
      },
      github: {
        status: {
          arrowWarn: 'リポジトリを確認',
          arrowDefault: 'ステータス',
          loadingRepo: 'GitHub 設定を読み込み中…',
          readingConfig: 'site.yaml から GitHub 接続設定を読み込んでいます…',
          repoNotConfigured: 'GitHub リポジトリが設定されていません',
          repoConfigHint: 'site.yaml に repo.owner と repo.name を設定し、下書きのプッシュを有効にしてください。',
          checkingRepo: 'リポジトリへのアクセスを確認しています…',
          rateLimited: 'GitHub のレート制限に達しました。しばらくしてから再試行してください。',
          repoNotFound: 'GitHub にリポジトリが見つかりませんでした。',
          networkError: 'GitHub に接続できません。ネットワークを確認してください。',
          repoCheckFailed: 'リポジトリの確認に失敗しました。',
          repoConnectedDefault: ({ branch }) => `リポジトリに接続しました · 既定ブランチ「${branch}」`,
          checkingBranch: 'ブランチへのアクセスを確認しています…',
          branchNotFound: 'GitHub にブランチが見つかりませんでした。',
          branchCheckFailed: 'ブランチの確認に失敗しました。',
          repoConnected: 'リポジトリに接続しました',
          configUnavailable: 'GitHub 設定を取得できません',
          readFailed: 'site.yaml の読み込みに失敗しました。'
        }
      },
      footerNote: '❤️ で作られた <a href="https://deemoe404.github.io/NanoSite/" target="_blank" rel="noopener">NanoSite</a> を使って創作を楽しみましょう。'
    },
  }
  // Additional languages can be added here
};

let currentLang = DEFAULT_LANG;

function detectLang() {
  try {
    const url = new URL(window.location.href);
    const qp = (url.searchParams.get('lang') || '').trim();
    if (qp) return qp;
  } catch (_) {}
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch (_) {}
  const nav = (navigator.language || navigator.userLanguage || '').slice(0, 2);
  return nav || DEFAULT_LANG;
}

export function initI18n(opts = {}) {
  const desired = (opts.lang || detectLang() || '').toLowerCase();
  const def = (opts.defaultLang || DEFAULT_LANG).toLowerCase();
  currentLang = desired || def;
  baseDefaultLang = def || DEFAULT_LANG;
  // If translation bundle missing, fall back to default bundle for UI
  if (!translations[currentLang]) currentLang = def;
  // Persist only when allowed (default: true). This enables callers to
  // perform a non-persistent bootstrap before site config is loaded.
  const shouldPersist = (opts && Object.prototype.hasOwnProperty.call(opts, 'persist')) ? !!opts.persist : true;
  if (shouldPersist) {
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (_) {}
  }
  // Reflect on <html lang>
  document.documentElement.setAttribute('lang', currentLang);
  // Update a few static DOM bits (placeholders, site card)
  applyStaticTranslations();
  return currentLang;
}

export function getCurrentLang() { return currentLang; }

// Translate helper: fetches a nested value from the current language bundle,
// with graceful fallback to the default language.
export function t(path, vars) {
  const segs = String(path || '').split('.');
  const pick = (lang) => segs.reduce((o, k) => (o && o[k] != null ? o[k] : undefined), translations[lang] || {});
  let val = pick(currentLang);
  if (val == null) val = pick(DEFAULT_LANG);
  if (typeof val === 'function') return val(vars);
  return val != null ? String(val) : path;
}

// (language switcher helpers are defined near the end of the file)

// --- Content loading (unified JSON with fallback, plus legacy support) ---

// Normalize common language labels seen in content JSON to BCP-47-ish codes
export function normalizeLangKey(k) {
  const raw = String(k || '').trim();
  const lower = raw.toLowerCase();
  const map = new Map([
    ['english', 'en'],
    ['en', 'en'],
    ['中文', 'zh'],
    ['简体中文', 'zh'],
    ['zh', 'zh'],
    ['zh-cn', 'zh'],
    ['日本語', 'ja'],
    ['にほんご', 'ja'],
    ['ja', 'ja'],
    ['jp', 'ja']
  ]);
  if (map.has(lower)) return map.get(lower);
  // If looks like a code (xx or xx-YY), return lower base
  if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(raw)) return lower;
  return raw; // fallback to original
}

// Attempt to transform a unified content JSON object into a flat map
// for the current language with default fallback.
function transformUnifiedContent(obj, lang) {
  const RESERVED = new Set(['tag', 'tags', 'image', 'date', 'excerpt']);
  const out = {};
  const langsSeen = new Set();
  for (const [key, val] of Object.entries(obj || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    // Collect language variants on this entry
    let chosen = null;
    let title = null;
    let location = null;
    // Gather variant keys excluding reserved
    const variantKeys = Object.keys(val).filter(k => !RESERVED.has(k));
    // Track langs available on this entry
    variantKeys.forEach(k => {
      const nk = normalizeLangKey(k);
      if (nk !== 'default') langsSeen.add(nk);
    });
    // Pick requested language, else default
    const tryPick = (lk) => {
      if (!lk) return null;
      const v = val[lk];
      if (v == null) return null;
      if (typeof v === 'string') return { title: null, location: v };
      if (typeof v === 'object') return { title: v.title || null, location: v.location || null, excerpt: v.excerpt || null };
      return null;
    };
    // Try requested lang, then site default, then common English code, then legacy 'default'
    const nlang = normalizeLangKey(lang);
    chosen = tryPick(nlang) || tryPick(baseDefaultLang) || tryPick('en') || tryPick('default');
    // If still not chosen, fall back to the first available variant (for single-language entries)
    if (!chosen && variantKeys.length) {
      for (const vk of variantKeys) {
        const pick = tryPick(normalizeLangKey(vk));
        if (pick) { chosen = pick; break; }
      }
    }
    // Fallback to legacy flat shape if not unified
    if (!chosen && 'location' in val) {
      chosen = { title: key, location: String(val.location || '') };
    }
    if (!chosen || !chosen.location) continue;
    title = chosen.title || key;
    location = chosen.location;
    const meta = {
      location,
      image: val.image || undefined,
      tag: val.tag != null ? val.tag : (val.tags != null ? val.tags : undefined),
      date: val.date || undefined,
      // Prefer language-specific excerpt; fall back to top-level excerpt for legacy data
      excerpt: (chosen && chosen.excerpt) || val.excerpt || undefined
    };
    out[title] = meta;
  }
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

// Load content metadata from simplified JSON and Markdown front matter
// Supports per-language single path (string) OR multiple versions (array of strings)
async function loadContentFromFrontMatter(obj, lang) {
  const out = {};
  const langsSeen = new Set();
  const nlang = normalizeLangKey(lang);
  const truthy = (v) => {
    if (v === true) return true;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on' || s === 'enabled';
  };
  
  // Collect all available languages from the simplified JSON
  for (const [key, val] of Object.entries(obj || {})) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.keys(val).forEach(k => {
        const nk = normalizeLangKey(k);
        if (nk !== 'default') langsSeen.add(nk);
      });
    }
  }
  
  // Process each entry
  for (const [key, val] of Object.entries(obj || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    
    // Resolve the best language bucket first
    let chosenBucketKey = null;
    if (val[nlang] != null) chosenBucketKey = nlang;
    else if (val[baseDefaultLang] != null) chosenBucketKey = baseDefaultLang;
    else if (val['en'] != null) chosenBucketKey = 'en';
    else if (val['default'] != null) chosenBucketKey = 'default';
    // Fallback to first available key when none matched
    if (!chosenBucketKey) {
      const firstKey = Object.keys(val)[0];
      if (firstKey) chosenBucketKey = firstKey;
    }
    if (!chosenBucketKey) continue;

    const raw = val[chosenBucketKey];
    // Normalize to an array of paths (versions)
    const paths = Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : (typeof raw === 'string' ? [raw] : []);
    if (!paths.length) continue;

    const variants = [];
    for (const p of paths) {
      try {
        const url = `${getContentRoot()}/${p}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response || !response.ok) { continue; }
        const content = await response.text();
        const { frontMatter } = parseFrontMatter(content);

        // Resolve relative image (e.g., 'cover.jpg') against this markdown's folder
        const resolveImagePath = (img) => {
          const s = String(img || '').trim();
          if (!s) return undefined;
          if (/^(https?:|data:)/i.test(s) || s.startsWith('/')) return s;
          const lastSlash = p.lastIndexOf('/');
          const baseDir = lastSlash >= 0 ? p.slice(0, lastSlash + 1) : '';
          return (baseDir + s).replace(/\/+/g, '/');
        };

        variants.push({
          location: p,
          image: resolveImagePath(frontMatter.image) || undefined,
          tag: frontMatter.tags || frontMatter.tag || undefined,
          date: frontMatter.date || undefined,
          excerpt: frontMatter.excerpt || undefined,
          versionLabel: frontMatter.version || undefined,
          ai: truthy(frontMatter.ai || frontMatter.aiGenerated || frontMatter.llm) || undefined,
          draft: truthy(frontMatter.draft || frontMatter.wip || frontMatter.unfinished || frontMatter.inprogress) || undefined,
          __title: frontMatter.title || undefined
        });
      } catch (error) {
        console.warn(`Failed to load content from ${p}:`, error);
        variants.push({ location: p });
      }
    }

    // Choose the latest by date as the primary version
    const toTime = (d) => { const t = new Date(String(d || '')).getTime(); return Number.isFinite(t) ? t : -Infinity; };
    variants.sort((a, b) => toTime(b.date) - toTime(a.date));
    const primary = variants[0];
    if (!primary) continue;

    // The displayed title prefers the primary's title
    const title = (primary.__title) || key;
    const { __title, versionLabel, ...restPrimary } = primary;
    const meta = { ...restPrimary, versionLabel };
    // Attach versions list for UI switching (omit internal title field)
    meta.versions = variants.map(v => {
      const { __title: _t, ...rest } = v;
      return rest;
    });
    out[title] = meta;
  }
  
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

// Try to load unified YAML (`base.yaml`) first; if not unified or missing, fallback to legacy
// per-language files (base.<currentLang>.yaml -> base.<default>.yaml -> base.yaml)
export async function loadContentJson(basePath, baseName) {
  // YAML only (unified or simplified)
  try {
    const obj = await fetchConfigWithYamlFallback([
      `${basePath}/${baseName}.yaml`,
      `${basePath}/${baseName}.yml`
    ]);
    if (obj && typeof obj === 'object' && Object.keys(obj).length) {
      // Heuristic: if any entry contains a `default` or a non-reserved language-like key, treat as unified
      const keys = Object.keys(obj || {});
      let isUnified = false;
      let isSimplified = false;
      
      // Check if it's a simplified format (just path mappings) or unified format
      for (const k of keys) {
        const v = obj[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          // Check for simplified format (language -> path mapping)
          const innerKeys = Object.keys(v);
          const hasOnlyPaths = innerKeys.every(ik => {
            const val = v[ik];
            if (typeof val === 'string') return true;
            if (Array.isArray(val)) return val.every(item => typeof item === 'string');
            return false;
          });
          
          if (hasOnlyPaths) {
            isSimplified = true;
            break;
          }
          
          // Check for unified format
          if ('default' in v) { isUnified = true; break; }
          if (innerKeys.some(ik => !['tag','tags','image','date','excerpt','location'].includes(ik))) { isUnified = true; break; }
        }
      }
      
      if (isSimplified) {
        // Handle simplified format - load metadata from front matter
        const current = getCurrentLang();
        const { entries, availableLangs } = await loadContentFromFrontMatter(obj, current);
        __setContentLangs(availableLangs);
        return entries;
      }
      
      if (isUnified) {
        const current = getCurrentLang();
        const { entries, availableLangs } = transformUnifiedContent(obj, current);
        // Record available content languages so the dropdown can reflect them
        __setContentLangs(availableLangs);
        return entries;
      }
      // Not unified; fall through to legacy handling below
    }
  } catch (_) { /* fall back */ }

  // Legacy per-language YAML chain
  return loadLangJson(basePath, baseName);
}

// Transform unified tabs YAML into a flat map: title -> { location }
function transformUnifiedTabs(obj, lang) {
  const out = {};
  const langsSeen = new Set();
  for (const [key, val] of Object.entries(obj || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const variantKeys = Object.keys(val);
    variantKeys.forEach(k => {
      const nk = normalizeLangKey(k);
      if (nk !== 'default') langsSeen.add(nk);
    });
    const tryPick = (lk) => {
      if (!lk) return null;
      const v = val[lk];
      if (v == null) return null;
      if (typeof v === 'string') return { title: null, location: v };
      if (typeof v === 'object') return { title: v.title || null, location: v.location || null };
      return null;
    };
    const nlang = normalizeLangKey(lang);
    let chosen = tryPick(nlang) || tryPick(baseDefaultLang) || tryPick('en') || tryPick('default');
    // If not found, fall back to the first available variant to ensure visibility
    if (!chosen && variantKeys.length) {
      for (const vk of variantKeys) {
        const pick = tryPick(normalizeLangKey(vk));
        if (pick) { chosen = pick; break; }
      }
    }
    if (!chosen && 'location' in val) chosen = { title: key, location: String(val.location || '') };
    if (!chosen || !chosen.location) continue;
    const title = chosen.title || key;
    // Provide a stable slug derived from the base key so it stays consistent across languages
    const stableSlug = String(key || '').toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || ('t-' + Math.abs(Array.from(String(key||'')).reduce((h,c)=>((h<<5)-h)+c.charCodeAt(0)|0,0)).toString(36));
    out[title] = { location: chosen.location, slug: stableSlug };
  }
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

// Load tabs in unified format first, then fall back to legacy per-language files
export async function loadTabsJson(basePath, baseName) {
  try {
    const obj = await fetchConfigWithYamlFallback([
      `${basePath}/${baseName}.yaml`,
      `${basePath}/${baseName}.yml`
    ]);
    if (obj && typeof obj === 'object') {
      let isUnified = false;
      for (const [k, v] of Object.entries(obj || {})) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if ('default' in v) { isUnified = true; break; }
          const inner = Object.keys(v);
          if (inner.some(ik => !['location'].includes(ik))) { isUnified = true; break; }
        }
      }
      if (isUnified) {
        const current = getCurrentLang();
        const { entries, availableLangs } = transformUnifiedTabs(obj, current);
        __setContentLangs(availableLangs);
        return entries;
      }
    }
  } catch (_) { /* fall through */ }
  return loadLangJson(basePath, baseName);
}

// Ensure lang param is included when generating internal links
export function withLangParam(urlStr) {
  try {
    const url = new URL(urlStr, window.location.href);
    url.searchParams.set('lang', currentLang);
    return url.search ? `${url.pathname}${url.search}` : url.pathname;
  } catch (_) {
    // Fallback: naive append
    const joiner = urlStr.includes('?') ? '&' : '?';
    return `${urlStr}${joiner}lang=${encodeURIComponent(currentLang)}`;
  }
}

// Try to load JSON for a given base name with lang suffix, falling back in order:
// base.<currentLang>.json -> base.<default>.json -> base.json
export async function loadLangJson(basePath, baseName) {
  const attempts = [
    `${basePath}/${baseName}.${currentLang}.yaml`,
    `${basePath}/${baseName}.${currentLang}.yml`,
    `${basePath}/${baseName}.${DEFAULT_LANG}.yaml`,
    `${basePath}/${baseName}.${DEFAULT_LANG}.yml`,
    `${basePath}/${baseName}.yaml`,
    `${basePath}/${baseName}.yml`
  ];
  try {
    return await fetchConfigWithYamlFallback(attempts);
  } catch (_) {
    return {};
  }
}

// Update static DOM bits outside main render cycle (sidebar card, search placeholder)
function applyStaticTranslations() {
  // Search placeholder
  const input = document.getElementById('searchInput');
  if (input) input.setAttribute('placeholder', t('sidebar.searchPlaceholder'));
}

// Expose translations for testing/customization
export const __translations = translations;

// Friendly names for the language switcher. Add an entry when you add a new language.
const languageNames = { en: 'English', zh: '简体中文', ja: '日本語' };
let __contentLangs = null;
function __setContentLangs(list) {
  try {
    const add = Array.isArray(list) && list.length ? Array.from(new Set(list)) : [];
    if (!__contentLangs || !__contentLangs.length) {
      __contentLangs = add.length ? add : null;
    } else if (add.length) {
      const s = new Set(__contentLangs);
      add.forEach(x => s.add(x));
      __contentLangs = Array.from(s);
    }
  } catch (_) { /* ignore */ }
}
export function getAvailableLangs() {
  // Prefer languages discovered from content (unified index), else UI bundle keys
  return (__contentLangs && __contentLangs.length) ? __contentLangs : Object.keys(translations);
}
export function getLanguageLabel(code) { return languageNames[code] || code; }

// Programmatic language switching used by the sidebar dropdown
export function switchLanguage(langCode) {
  const code = String(langCode || '').toLowerCase();
  if (!code) return;
  try { localStorage.setItem(STORAGE_KEY, code); } catch (_) {}
  document.documentElement.setAttribute('lang', code);
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', code);
    window.location.assign(url.toString());
  } catch (_) {
    const joiner = window.location.search ? '&' : '?';
    window.location.assign(window.location.pathname + window.location.search + `${joiner}lang=${encodeURIComponent(code)}`);
  }
}
