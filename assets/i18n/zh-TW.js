export const languageMeta = { label: '正體中文（台灣）' };

const translations = {
    ui: {
      allPosts: '全部文章',
      searchTab: '搜尋',
      postTab: '文章',
      prev: '上一頁',
      next: '下一頁',
      contents: '目錄',
      loading: '載入中…',
      top: '頂部',
      minRead: '分鐘閱讀',
      close: '關閉',
      copyLink: '複製連結',
      linkCopied: '已複製連結',
      versionLabel: '版本',
      versionsCount: (n) => `${n} 個版本`,
      latestSuffix: '（最新）',
      outdatedWarning: '提示：這篇文章釋出已久，內容可能已過時。',
      notFound: '未找到',
      pageUnavailable: '頁面不可用',
      indexUnavailable: '索引不可用',
      backToAllPosts: '返回全部文章',
      backToHome: '返回首頁',
      noResultsTitle: '沒有結果',
      noResultsBody: (q) => `未找到與 “${q}” 匹配的文章。`,
      tags: '標籤',
      tagSearch: (tag) => `標籤：${tag}`,
      allTags: '全部標籤',
      more: '更多',
      less: '收起',
      details: '詳情',
      copyDetails: '複製詳情',
      reportIssue: '報告問題',
      warning: '警告',
      error: '錯誤',
      aiFlagLabel: 'AI 參與',
      aiFlagTooltip: 'AI 參與：本文由生成式 LLM 生成或修改',
      draftBadge: '草稿',
      draftNotice: '本文仍在撰寫/修改中，內容可能隨時變更。'
    },
    code: {
      copy: '複製',
      copied: '已複製',
      failed: '複製失敗',
      copyAria: '複製程式碼'
    },
    errors: {
      postNotFoundTitle: '文章未找到',
      postNotFoundBody: '無法載入所請求的文章。',
      pageUnavailableTitle: '頁面不可用',
      pageUnavailableBody: '無法載入該頁面。',
      indexUnavailableBody: '無法載入文章索引。請檢查網路或儲存庫內容。'
    },
    sidebar: {
      searchPlaceholder: '搜尋文章…',
      siteTitle: 'Phyllali 的部落格',
      siteSubtitle: '感謝遊玩我的遊戲。',
      socialGithub: 'GitHub'
    },
    tools: {
      sectionTitle: '功能區',
      toggleTheme: '切換主題',
      postEditor: '文章編輯器',
      themePack: '主題包',
      language: '語言',
      resetLanguage: '重置語言'
    },
    toc: {
      toggleAria: '展開/摺疊章節',
      copied: '已複製！'
    },
    titles: {
      allPosts: '全部文章',
      search: (q) => `搜尋：${q}`
    },
    editor: {
      pageTitle: 'Markdown 編輯器 - NanoSite',
      languageLabel: '語言',
      verifying: '正在驗證…',
      verify: '驗證',
      nav: {
        modeSwitchAria: '模式切換',
        dynamicTabsAria: '開啟編輯器標籤'
      },
      modes: {
        composer: '編排器',
        editor: '編輯器',
        updates: '系統更新'
      },
      status: {
        localLabel: '本地',
        checkingDrafts: '正在檢查草稿…',
        synced: '已同步',
        upload: '上傳',
        remoteLabel: 'GitHub',
        loadingRepo: '正在載入 GitHub 設定…',
        checkingConnection: '正在檢查連線…',
        clean: '沒有本地更改'
      },
      systemUpdates: {
        tabLabel: '系統更新',
        title: '系統更新',
        openDownload: '下載釋出 ZIP',
        downloadAssetLink: ({ name }) => `下載 ${name}`,
        openReleasePage: '在 GitHub 檢視釋出頁',
        selectArchive: '選擇已下載的 ZIP',
        filesHeading: '待更新的系統檔案',
        releaseNotes: '釋出說明',
        noNotes: '此次釋出未提供額外說明。',
        latestLabel: ({ name, tag }) => `最新發布：${name}${tag ? `（${tag}）` : ''}`,
        publishedLabel: ({ date }) => `釋出時間：${date}`,
        assetLabel: ({ name, size }) => `附件：${name}（${size}）`,
        assetWithHash: ({ name, size, hash }) => `附件：${name}（${size}） — SHA-256 ${hash}`,
        noAsset: '此釋出沒有可下載的附件。',
        status: {
          idle: '先下載最新的釋出 ZIP，然後選擇該檔案以檢查更新。',
          reading: '正在讀取壓縮包…',
          verifying: '正在校驗壓縮包…',
          noChanges: '系統檔案已是最新狀態。',
          comparing: '正在比對下載的檔案…',
          changes: ({ count }) => `有 ${count} 個系統檔案待更新。`
        },
        errors: {
          releaseFetch: '無法載入最新發布資訊。',
          emptyFile: '選擇的檔案為空。',
          invalidArchive: '選中的 ZIP 無法作為 NanoSite 釋出讀取。',
          sizeMismatch: ({ expected, actual }) => `選中的壓縮包大小（${actual}）與釋出附件（${expected}）不一致。`,
          generic: '系統更新失敗，請重試。'
        },
        fileStatus: {
          added: '新檔案',
          modified: '已更新'
        },
        summary: {
          added: '新增的系統檔案',
          modified: '已更新的系統檔案'
        }
      },
      currentFile: {
        status: {
          checking: '正在檢查檔案…',
          existing: '已存在的檔案',
          missing: '新檔案',
          error: '無法載入檔案'
        },
        meta: {
          checking: '正在檢查…',
          checkingStarted: ({ time }) => `正在檢查… 開始於${time}`,
          lastChecked: ({ time }) => `上次檢查：${time}`
        },
        draft: {
          justNow: '剛剛',
          savedHtml: ({ time }) => `本地草稿已於${time}儲存`,
          saved: '本地草稿已儲存',
          savedConflictHtml: ({ time }) => `本地草稿已於${time}儲存（遠端已更新）`,
          conflict: '本地草稿（遠端已更新）',
          available: '本地草稿可用'
        }
      },
      toolbar: {
        wrap: '換行：',
        wrapOn: '開',
        wrapOff: '關',
        view: '檢視：',
        viewEdit: '編輯',
        viewPreview: '預覽',
        discard: '丟棄',
        wrapAria: '換行設定',
        viewAria: '檢視切換'
      },
      toast: {
        openAction: '開啟',
        closeAria: '關閉通知'
      },
      toasts: {
        remoteMarkdownMismatch: '遠端 Markdown 與本地草稿不同。繼續前請檢查差異。',
        markdownSynced: 'Markdown 已與 GitHub 同步。',
        remoteCheckCanceledUseRefresh: '遠端檢查已取消。提交準備好後請點選“重新整理”。',
        yamlParseFailed: ({ label }) => `已獲取 ${label}，但無法解析 YAML。`,
        yamlUpdatedDifferently: ({ label }) => `${label} 在 GitHub 上的更新不同。請檢查高亮的差異。`,
        yamlSynced: ({ label }) => `${label} 已與 GitHub 同步。`,
        remoteCheckCanceledClickRefresh: '遠端檢查已取消。提交準備好後請點選“重新整理”。',
        popupBlocked: '瀏覽器阻止了 GitHub 視窗。請允許此站點的彈出視窗後重試。',
        openGithubAction: '開啟 GitHub',
        markdownOpenBeforeInsert: '請先開啟一個 Markdown 檔案再插入圖片。',
        assetAttached: ({ label }) => `已附加 ${label}`,
        noPendingChanges: '沒有待提交的更改。',
        siteWaitStopped: '已停止等待線上站點。提交已在 GitHub 上，但顯示可能還需要幾分鐘。',
        siteWaitTimedOut: '已將檔案提交到 GitHub，但線上站點未及時更新。請手動檢查部署狀態。',
        commitSuccess: ({ count }) => `已將 ${count} 個檔案提交到 GitHub。`,
        githubCommitFailed: '提交到 GitHub 失敗。',
        githubTokenRejected: 'GitHub 拒絕了訪問令牌。請輸入新的細粒度個人訪問令牌。',
        repoOwnerMissing: '請在 site.yaml 中配置 repo.owner 和 repo.name 以啟用 GitHub 同步。',
        markdownOpenBeforePush: '請先開啟一個 Markdown 檔案再推送到 GitHub。',
        repoConfigMissing: '請在 site.yaml 中配置儲存庫資訊以啟用 GitHub 推送。',
        invalidMarkdownPath: '無效的 Markdown 路徑。',
        unableLoadLatestMarkdown: '在推送前無法載入最新的 Markdown。',
        markdownNotReady: 'Markdown 檔案尚未準備好推送。',
        unableResolveGithubFile: '無法解析此檔案的 GitHub 連結。',
        markdownOpenBeforeDiscard: '請先開啟一個 Markdown 檔案再丟棄本地更改。',
        noLocalMarkdownChanges: '沒有可丟棄的本地 Markdown 更改。',
        discardSuccess: ({ label }) => `已丟棄 ${label} 的本地更改。`,
        discardFailed: '丟棄本地 Markdown 更改失敗。',
        unableResolveYamlSync: '無法解析用於 YAML 同步的 GitHub 連結。',
        yamlUpToDate: ({ name }) => `${name} 已是最新。`,
        yamlCopiedNoRepo: '已複製 YAML。請在 site.yaml 中配置儲存庫以開啟 GitHub。'
      },
      editorTools: {
        aria: '編輯器工具',
        formatGroupAria: '格式快捷鍵',
        bold: '加粗',
        italic: '斜體',
        strike: '刪除線',
        heading: '標題',
        quote: '引用',
        code: '行內程式碼',
        codeBlock: '程式碼塊',
        articleCard: '文章卡片',
        insertCardTitle: '插入文章卡片',
        insertImage: '插入圖片',
        cardDialogAria: '插入文章卡片',
        cardSearch: '搜尋文章…',
        cardEmpty: '沒有匹配的文章',
        hints: {
          bold: '未選擇文字。先選中文字，再點選“加粗”以用 ** ** 包裹。',
          italic: '未選擇文字。先選中文字，再點選“斜體”以用 * * 包裹。',
          strike: '未選擇文字。先選中文字，再點選“刪除線”以用 ~~ ~~ 包裹。',
          heading: '選中行或將游標放在空行上，然後點選“標題”在前面加上“# ”。',
          quote: '選中行或將游標放在空行上，然後點選“引用”在前面加上“> ”。',
          code: '未選擇文字。先選中文字，再點選“行內程式碼”以用反引號包裹。',
          codeBlock: '選中行或將游標放在空行上，然後點選“程式碼塊”以用 ``` 包裹。',
          insertCard: '將游標放在空行上，然後點選以插入文章卡片。若沒有文章，請等待索引載入或在 index.yaml 中新增條目。'
        }
      },
      editorPlaceholder: '# 你好，NanoSite\n\n開始撰寫 Markdown…',
      editorTextareaAria: 'Markdown 源',
      empty: {
        title: '當前沒有開啟編輯器',
        body: '從編排器開啟 Markdown 以開始編輯。'
      },
      composer: {
        fileSwitchAria: '檔案切換',
        fileLabel: '檔案：',
        fileArticles: '文章',
        filePages: '頁面',
        fileSite: '站點',
        addPost: '新增文章條目',
        addTab: '新增標籤條目',
        refresh: '重新整理',
        refreshTitle: '獲取最新遠端快照',
        refreshing: '正在重新整理…',
        discard: '丟棄',
        discardTitle: '丟棄本地草稿並重新載入遠端檔案',
        changeSummary: '更改摘要',
        reviewChanges: '檢視更改',
        inlineEmpty: '暫無可比較的條目。',
        indexInlineAria: 'index.yaml 的舊順序',
        indexEditorAria: 'index.yaml 編輯器',
        tabsInlineAria: 'tabs.yaml 的舊順序',
        tabsEditorAria: 'tabs.yaml 編輯器',
        siteEditorAria: 'site.yaml 編輯器',
        noLocalChangesToCommit: '沒有本地更改可提交。',
        noLocalChangesYet: '暫時沒有本地更改。',
        dialogs: {
          cancel: '取消',
          confirm: '確認',
          close: '關閉'
        },
        statusMessages: {
          loadingConfig: '正在載入配置…',
          restoredDraft: ({ label }) => `已恢復 ${label} 的本地草稿`,
          refreshSuccess: ({ name }) => `${name} 已從遠端重新整理`,
          remoteUpdated: '遠端快照已更新。高亮部分現在包含遠端差異。',
          remoteUnchanged: '遠端快照未發生變化。',
          refreshFailed: '重新整理遠端快照失敗'
        },
        site: {
          addLanguage: '新增語言',
          removeLanguage: '移除',
          noLanguages: '尚未配置語言。',
          promptLanguage: '請輸入語言程式碼（例如：en、zh、ja）：',
          languageExists: '該語言已經存在。',
          languageDefault: '預設',
          languageAutoOption: '自動檢測（瀏覽器語言）',
          reset: '恢復預設',
          addLink: '新增連結',
          removeLink: '移除',
          noLinks: '暫無連結。',
          linkLabelTitle: '名稱',
          linkLabelPlaceholder: '名稱',
          linkHrefTitle: 'URL',
          linkHrefPlaceholder: 'https://example.com',
          toggleEnabled: '啟用',
          optionShow: '顯示',
          optionHide: '隱藏',
          repoOwner: '儲存庫所有者',
          repoName: '儲存庫名稱',
          repoBranch: '分支（可選）',
          repoOwnerPrefix: '@',
          repoNamePrefix: 'repo：',
          repoBranchPrefix: '分支：',
          sections: {
            identity: {
              title: '站點資訊',
              description: '配置導航欄中展示的站點名稱、標語和頭像。'
            },
            seo: {
              title: 'SEO 與分享',
              description: '提供用於搜尋引擎和連結預覽的元資訊。'
            },
            behavior: {
              title: '行為',
              description: '控制分頁、預設開啟的頁面以及“全部文章”的顯示。'
            },
            theme: {
              title: '主題',
              description: '設定訪問者預設使用的主題方案。'
            },
            repo: {
              title: '儲存庫',
              description: '配置 GitHub 資訊，以啟用提交與“報告問題”連結。'
            },
            assets: {
              title: '資源提醒',
              description: '為體積較大的圖片顯示警告。'
            },
            extras: {
              title: '其他欄位',
              description: '檢測到但不可在此編輯的 site.yaml 欄位。'
            }
          },
          fields: {
            siteTitle: '站點標題',
            siteTitleHelp: '顯示在導航欄與頁面元資訊中。',
            siteSubtitle: '站點副標題',
            siteSubtitleHelp: '顯示在導航欄標題下方。',
            avatar: '頭像',
            avatarHelp: '頭像圖片的相對路徑或完整 URL。',
            resourceURL: '資源 URL',
            resourceURLHelp: '指向已釋出 wwwroot 目錄的絕對地址（可選）。',
            contentRoot: '內容根目錄',
            contentRootHelp: '存放 index.yaml 與 tabs.yaml 的資料夾。',
            siteDescription: '站點描述',
            siteDescriptionHelp: '用於 SEO 和分享連結的可選描述。',
            siteKeywords: '站點關鍵詞',
            siteKeywordsHelp: '用於 SEO 的逗號分隔關鍵詞（可選）。',
            profileLinks: '個人連結',
            profileLinksHelp: '顯示在頭像附近的個人或社交連結。',
            navLinks: '導航連結',
            navLinksHelp: '顯示在導航選單中的自定義連結。',
            defaultLanguage: '預設語言',
            defaultLanguageHelp: '當瀏覽器首選語言不匹配時使用的語言程式碼。',
            contentOutdatedDays: '過期提醒（天）',
            contentOutdatedDaysHelp: '文章超過此天數會標記為可能過期。留空則禁用。',
            pageSize: '每頁文章數',
            pageSizeHelp: '“全部文章”頁面每頁最多顯示的文章數量。',
            showAllPosts: '顯示“全部文章”',
            showAllPostsHelp: '在導航中顯示“全部文章”標籤頁。',
            landingTab: '預設標籤頁',
            landingTabHelp: '選擇站點載入時首先開啟的標籤頁。',
            landingTabAllPostsOption: '“全部文章”標籤頁',
            cardCoverFallback: '生成預設封面',
            cardCoverFallbackHelp: '當文章沒有封面時生成一張替代封面。',
            errorOverlay: '錯誤浮層',
            errorOverlayHelp: '在發生執行時錯誤時顯示除錯浮層。',
            themeMode: '主題模式',
            themeModeHelp: '預設的主題模式（user / system / light / dark）。',
            themePack: '主題包',
            themePackHelp: '預設載入的主題包資料夾名稱。',
            themeOverride: '鎖定主題',
            themeOverrideHelp: '強制使用所選主題，忽略訪問者的切換。',
            repo: 'GitHub 儲存庫',
            repoHelp: '用於提交、推送到 GitHub 以及“報告問題”連結。',
            assetLargeImage: '大圖警告',
            assetLargeImageHelp: '當附件圖片超過閾值時提醒編輯。',
            assetLargeImageThreshold: '大圖閾值（KB）',
            assetLargeImageThresholdHelp: '觸發警告的大小（千位元組）。留空表示使用預設值。',
            extras: '保留欄位',
            extrasHelp: '這些欄位會保留在 site.yaml 中，需要手動編輯。'
          }
        },
        entryRow: {
          gripHint: '拖動以重新排序',
          details: '詳情',
          delete: '刪除'
        },
        languages: {
          count: ({ count }) => `${count} 種語言`,
          addVersion: '+ 版本',
          removeLanguage: '刪除語言',
          addLanguage: '+ 新增語言',
          removedVersions: ({ versions }) => `已移除：${versions}`,
          placeholders: {
            indexPath: 'post/.../file.md',
            tabPath: 'tab/.../file.md'
          },
          fields: {
            title: '標題',
            location: '路徑'
          },
          actions: {
            edit: '編輯',
            open: '在編輯器中開啟',
            moveUp: '上移',
            moveDown: '下移',
            remove: '移除'
          }
        },
        entryKinds: {
          post: {
            label: '文章',
            confirm: '新增文章條目',
            placeholder: '文章鍵',
            message: '請輸入新的文章鍵（僅限字母和數字）：'
          },
          tab: {
            label: '標籤頁',
            confirm: '新增標籤頁條目',
            placeholder: '標籤頁鍵',
            message: '請輸入新的標籤頁鍵（僅限字母和數字）：'
          }
        },
        diff: {
          heading: '更改',
          title: ({ label }) => `更改 — ${label}`,
          close: '關閉',
          subtitle: {
            default: '檢視與遠端基線的差異。',
            overview: '檢視未同步更改的摘要。',
            entries: '檢視新增、刪除和修改的條目。',
            order: '遠端基線（左）· 當前順序（右）'
          },
          tabs: {
            overview: '概覽',
            entries: '條目',
            order: '順序'
          },
          order: {
            remoteTitle: '遠端',
            currentTitle: '當前',
            empty: '暫無可比較的條目。',
            inlineAllNew: '當前所有條目相較基線均為新增內容。',
            emptyKey: '（空）',
            badges: {
              to: ({ index }) => `→ #${index}`,
              from: ({ index }) => `來自 #${index}`,
              removed: '已移除',
              added: '新條目'
            }
          },
          orderStats: {
            empty: '無直接移動；更改來自新增或刪除',
            moved: ({ count }) => `移動 ${count}`,
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
            orderChanged: '順序已更改',
            orderParts: {
              moved: ({ count }) => `${count} 項移動`,
              added: ({ count }) => `+${count} 新增`,
              removed: ({ count }) => `-${count} 已移除`
            },
            orderSummary: ({ parts }) => `順序：${parts}`,
            langs: ({ summary }) => `語言：${summary}`,
            none: '檢測到更改。'
          },
          inline: {
            title: '更改摘要',
            ariaOrder: ({ label }) => `${label} 的舊順序`,
            openAria: ({ label }) => `開啟 ${label} 的更改概覽`
          },
          overview: {
            empty: '該檔案沒有檢測到更改。',
            stats: {
              added: '新增',
              removed: '已移除',
              modified: '已修改',
              order: '順序',
              changed: '已更改',
              unchanged: '未更改'
            },
            blocks: {
              added: '新增條目',
              removed: '已移除的條目',
              modified: '已修改的條目'
            },
            languagesImpacted: ({ languages }) => `受影響的語言：${languages}`
          },
          entries: {
            noLanguageContent: '未記錄任何語言內容。',
            snapshot: {
              indexValue: ({ count }) => `${count} 個值`,
              emptyEntry: '空條目',
              tabTitle: ({ title }) => `標題 “${title}”`,
              tabLocation: ({ location }) => `位置 ${location}`
            },
            summary: ({ lang, summary }) => `${lang}：${summary}`,
            state: {
              added: ({ lang }) => `${lang}：已新增`,
              removed: ({ lang }) => `${lang}：已移除`,
              updatedFields: ({ lang, fields }) => `${lang}：已更新 ${fields}`
            },
            parts: {
              typeChanged: '型別已更改',
              addedCount: ({ count }) => `+${count} 新增`,
              removedCount: ({ count }) => `-${count} 已移除`,
              updatedCount: ({ count }) => `${count} 項已更新`,
              reordered: '順序已調整',
              contentUpdated: '內容已更新'
            },
            join: {
              comma: '、',
              and: ' 和 '
            },
            fields: {
              title: '標題',
              location: '位置',
              content: '內容'
            },
            empty: '沒有檢測到內容差異。',
            sections: {
              added: '新增條目',
              removed: '已移除的條目',
              modified: '已修改的條目'
            },
            orderOnly: '該檔案僅更改了順序。'
          }
        },
        github: {
          modal: {
            title: '與 GitHub 同步',
            subtitle: '請提供具備儲存庫內容存取權限的精細化個人訪問令牌。',
            summaryTitle: '將提交以下檔案：',
            summaryTextFilesTitle: '內容檔案',
            summarySystemFilesTitle: '系統檔案',
            summarySeoFilesTitle: 'SEO 檔案',
            summaryAssetFilesTitle: '資原始檔',
            summaryEmpty: '沒有待提交的檔案。',
            tokenLabel: '精細化個人訪問令牌',
            helpHtml: '請在 <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">github.com/settings/tokens</a> 建立一個具有儲存庫內容存取權限的令牌。該令牌僅在當前瀏覽器會話中儲存。',
            forget: '忘記令牌',
            submit: '提交更改',
            errorRequired: '請輸入精細化個人訪問令牌以繼續。'
          },
          preview: {
            subtitle: '上傳至 GitHub 之前預覽待提交的檔案。',
            unavailable: '無法預覽此檔案。',
            untitled: '未命名檔案'
          }
        },
        dialogs: {
          cancel: '取消',
          confirm: '確認',
          close: '關閉'
        },
        addEntryPrompt: {
          hint: '僅使用英文字母和數字。',
          confirm: '新增條目',
          defaultType: '條目',
          placeholder: '條目鍵名',
          message: ({ label }) => `請輸入新的 ${label} 鍵名：`,
          errorEmpty: '鍵名不能為空。',
          errorInvalid: '鍵名只能包含英文字母、數字、下劃線或連字元。',
          errorDuplicate: '該鍵名已存在，請使用其他鍵名。'
        },
        discardConfirm: {
          messageReload: ({ label }) => `丟棄 ${label} 的本地更改並重新載入遠端檔案？此操作無法撤銷。`,
          messageSimple: ({ label }) => `丟棄 ${label} 的本地更改？此操作無法撤銷。`,
          closeTabMessage: ({ label }) => `關閉 ${label}？關閉此標籤頁將放棄本地 Markdown 更改。`,
          closeTabFallback: '此標籤頁',
          discard: '丟棄',
          discarding: '正在丟棄…',
          successFresh: ({ label }) => `已丟棄本地更改；已載入最新的 ${label}`,
          successCached: ({ label }) => `已丟棄本地更改；已從快取快照恢復 ${label}`,
          failed: '丟棄本地更改失敗。'
        },
        markdown: {
          push: {
            labelDefault: '同步',
            labelCreate: '在 GitHub 上建立',
            labelUpdate: '同步',
            tooltips: {
              default: '複製草稿到 GitHub。',
              noRepo: '請在 site.yaml 中配置儲存庫以啟用 GitHub 推送。',
              noFile: '請先開啟一個 Markdown 檔案以啟用 GitHub 推送。',
              error: '推送前請先解決檔案載入錯誤。',
              checking: '正在檢查遠端版本…',
              loading: '正在載入遠端快照…',
              create: '複製草稿並在 GitHub 上建立該檔案。',
              update: '複製草稿並在 GitHub 上更新該檔案。'
            }
          },
          discard: {
            label: '丟棄',
            busy: '正在丟棄…',
            tooltips: {
              default: '丟棄本地 Markdown 更改並恢復上次載入的版本。',
              noFile: '請先開啟一個 Markdown 檔案再丟棄本地更改。',
              reload: '丟棄本地 Markdown 更改（將重新載入遠端快照）。'
            }
          },
          draftIndicator: {
            conflict: '本地草稿與遠端檔案存在衝突。',
            dirty: '編輯器中有未儲存的更改。',
            saved: '本地草稿已儲存在瀏覽器中。'
          },
          currentFile: '當前檔案',
          fileFallback: 'Markdown 檔案',
          openBeforeEditor: '請輸入 Markdown 路徑後再開啟編輯器。',
          toastCopiedCreate: '已複製 Markdown。GitHub 將開啟以建立該檔案。',
          toastCopiedUpdate: '已複製 Markdown。GitHub 將開啟以更新該檔案。',
          blockedCreate: '已複製 Markdown。如未開啟新標籤頁，請點選“開啟 GitHub”以建立該檔案。',
          blockedUpdate: '已複製 Markdown。如未開啟新標籤頁，請點選“開啟 GitHub”以更新該檔案。'
        },
        yaml: {
          toastCopiedUpdate: ({ name }) => `已複製 ${name}。GitHub 將開啟以貼上更新。`,
          toastCopiedCreate: ({ name }) => `已複製 ${name}。GitHub 將開啟以建立該檔案。`,
          blocked: ({ name }) => `已複製 ${name}。如未開啟新標籤頁，請點選“開啟 GitHub”。`
        },
        remoteWatcher: {
          waitingForCreate: ({ label }) => `正在等待 GitHub 建立 ${label}`,
          waitingForUpdate: ({ label }) => `正在等待 GitHub 更新 ${label}`,
          waitingForCommitStatus: '正在等待 GitHub 提交…',
          checkingRemoteChanges: '正在檢查遠端更改…',
          waitingForCommit: '正在等待提交…',
          stopWaiting: '停止等待',
          waitingForRemoteResponse: '正在等待遠端響應…',
          remoteCheckFailedRetry: '遠端檢查失敗，正在重試…',
          remoteFileNotFoundYet: '遠端檔案尚未找到…',
          remoteFileStillMissing: '遠端檔案仍缺失…',
          updateDetectedRefreshing: '檢測到更新，正在重新整理…',
          remoteFileDiffersWaiting: '遠端檔案內容與本地仍不一致，繼續等待…',
          remoteFileExistsDiffersWaiting: '遠端檔案已存在但內容不同，繼續等待…',
          mismatchAdvice: '如果你的 GitHub 提交確實不同，請取消並使用“重新整理”檢視。',
          remoteCheckCanceled: '遠端檢查已取消',
          errorWithDetail: ({ message }) => `錯誤：${message}`,
          networkError: '網路錯誤',
          fileNotFoundOnServer: '伺服器上未找到檔案',
          remoteSnapshotUpdated: '遠端快照已更新',
          waitingForGitHub: '正在等待 GitHub…',
          preparing: '正在準備…',
          waitingForLabel: ({ label }) => `正在等待 ${label} 在 GitHub 上更新…`,
          waitingForRemote: '正在等待遠端…',
          yamlNotFoundYet: ({ label }) => `${label} 在遠端尚未找到…`,
          remoteYamlDiffersWaiting: '遠端 YAML 與本地快照仍不一致，繼續等待…',
          remoteYamlExistsDiffersWaiting: '遠端 YAML 已更新但內容不同，繼續等待…',
          yamlMismatchAdvice: '如果提交與草稿不同，請取消並點選“重新整理”以拉取。'
        },
      },
      github: {
        status: {
          arrowWarn: '檢查儲存庫',
          arrowDefault: '狀態',
          loadingRepo: '正在載入 GitHub 設定…',
          readingConfig: '正在讀取 site.yaml 中的 GitHub 連線配置…',
          repoNotConfigured: '尚未配置 GitHub 儲存庫',
          repoConfigHint: '請在 site.yaml 中配置 repo.owner 和 repo.name，以啟用草稿推送。',
          checkingRepo: '正在檢查儲存庫存取權限…',
          rateLimited: '已觸發 GitHub 速率限制，請稍後再試。',
          repoNotFound: '在 GitHub 上未找到該儲存庫。',
          networkError: '無法連線到 GitHub，請檢查網路。',
          repoCheckFailed: '儲存庫檢查失敗。',
          repoConnectedDefault: ({ branch }) => `儲存庫已連線 · 預設分支“${branch}”`,
          checkingBranch: '正在檢查分支存取權限…',
          branchNotFound: '在 GitHub 上未找到該分支。',
          branchCheckFailed: '分支檢查失敗。',
          repoConnected: '儲存庫已連線',
          configUnavailable: '無法獲取 GitHub 配置',
          readFailed: '讀取 site.yaml 失敗。'
        }
      },
      footerNote: '由 ❤️ 打造，基於 <a href="https://deemoe404.github.io/NanoSite/" target="_blank" rel="noopener">NanoSite</a>。保持靈感，持續創作。'
    },
  }

export default translations;
