export const languageMeta = { label: 'English' };

const translations = {
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
      resetLanguage: 'Reset language'
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
        editor: 'Editor',
        updates: 'System Updates'
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
      systemUpdates: {
        tabLabel: 'System Updates',
        title: 'System Updates',
        openDownload: 'Download release ZIP',
        downloadAssetLink: ({ name }) => `Download ${name}`,
        openReleasePage: 'View release on GitHub',
        selectArchive: 'Select downloaded ZIP',
        filesHeading: 'Pending system files',
        releaseNotes: 'Release notes',
        noNotes: 'This release does not include additional notes.',
        latestLabel: ({ name, tag }) => `Latest release: ${name}${tag ? ` (${tag})` : ''}`,
        publishedLabel: ({ date }) => `Published on ${date}`,
        assetLabel: ({ name, size }) => `Asset: ${name} (${size})`,
        assetWithHash: ({ name, size, hash }) => `Asset: ${name} (${size}) — SHA-256 ${hash}`,
        noAsset: 'No downloadable assets were attached to this release.',
        status: {
          idle: 'Download the latest release ZIP, then select it to check for updates.',
          reading: 'Reading archive…',
          verifying: 'Verifying archive…',
          noChanges: 'System files are up to date.',
          comparing: 'Comparing downloaded files…',
          changes: ({ count }) => `${count} system file${count === 1 ? '' : 's'} pending update.`
        },
        errors: {
          releaseFetch: 'Unable to load latest release information.',
          emptyFile: 'The selected file is empty.',
          invalidArchive: 'The selected ZIP could not be read as a NanoSite release.',
          sizeMismatch: ({ expected, actual }) => `The selected archive size (${actual}) does not match the release asset (${expected}).`,
          generic: 'System update failed. Please try again.'
        },
        fileStatus: {
          added: 'New file',
          modified: 'Updated file'
        },
        summary: {
          added: 'new system file',
          modified: 'updated system file'
        }
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
          confirm: 'Confirm',
          close: 'Close'
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
          addLink: 'Add link',
          removeLink: 'Remove',
          noLinks: 'No links configured.',
          linkLabelTitle: 'Label',
          linkLabelPlaceholder: 'Label',
          linkHrefTitle: 'URL',
          linkHrefPlaceholder: 'https://example.com',
          toggleEnabled: 'Enable',
          optionShow: 'Show',
          optionHide: 'Hide',
          repoOwner: 'Repository owner',
          repoName: 'Repository name',
          repoBranch: 'Branch (optional)',
          repoOwnerPrefix: '@',
          repoNamePrefix: 'repo:',
          repoBranchPrefix: 'branch:',
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
            summaryTextFilesTitle: 'Content files',
            summarySystemFilesTitle: 'System files',
            summarySeoFilesTitle: 'SEO files',
            summaryAssetFilesTitle: 'Asset files',
            summaryEmpty: 'No pending files to commit.',
            tokenLabel: 'Fine-grained Personal Access Token',
            helpHtml: 'Create a token at <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">github.com/settings/tokens</a> with access to the repository\'s contents. The token is stored for this browser session only.',
            forget: 'Forget token',
            submit: 'Commit changes',
            errorRequired: 'Enter a Fine-grained Personal Access Token to continue.'
          },
          preview: {
            subtitle: 'Preview pending file before uploading to GitHub.',
            unavailable: 'Preview unavailable for this file.',
            untitled: 'Untitled file'
          }
        },
        dialogs: {
          cancel: 'Cancel',
          confirm: 'Confirm',
          close: 'Close'
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
  }

export default translations;
