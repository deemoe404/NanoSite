export const languageMeta = { label: '简体中文' };

const translations = {
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
      resetLanguage: '重置语言'
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
        editor: '编辑器',
        updates: '系统更新'
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
      systemUpdates: {
        tabLabel: '系统更新',
        title: '系统更新',
        openDownload: '下载发布 ZIP',
        downloadAssetLink: ({ name }) => `下载 ${name}`,
        openReleasePage: '在 GitHub 查看发布页',
        selectArchive: '选择已下载的 ZIP',
        filesHeading: '待更新的系统文件',
        releaseNotes: '发布说明',
        noNotes: '此次发布未提供额外说明。',
        latestLabel: ({ name, tag }) => `最新发布：${name}${tag ? `（${tag}）` : ''}`,
        publishedLabel: ({ date }) => `发布时间：${date}`,
        assetLabel: ({ name, size }) => `附件：${name}（${size}）`,
        assetWithHash: ({ name, size, hash }) => `附件：${name}（${size}） — SHA-256 ${hash}`,
        noAsset: '此发布没有可下载的附件。',
        status: {
          idle: '先下载最新的发布 ZIP，然后选择该文件以检查更新。',
          reading: '正在读取压缩包…',
          verifying: '正在校验压缩包…',
          noChanges: '系统文件已是最新状态。',
          comparing: '正在比对下载的文件…',
          changes: ({ count }) => `有 ${count} 个系统文件待更新。`
        },
        errors: {
          releaseFetch: '无法加载最新发布信息。',
          emptyFile: '选择的文件为空。',
          invalidArchive: '选中的 ZIP 无法作为 NanoSite 发布读取。',
          sizeMismatch: ({ expected, actual }) => `选中的压缩包大小（${actual}）与发布附件（${expected}）不一致。`,
          generic: '系统更新失败，请重试。'
        },
        fileStatus: {
          added: '新文件',
          modified: '已更新'
        },
        summary: {
          added: '新增的系统文件',
          modified: '已更新的系统文件'
        }
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
          confirm: '确认',
          close: '关闭'
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
          linkLabelTitle: '名称',
          linkLabelPlaceholder: '名称',
          linkHrefTitle: 'URL',
          linkHrefPlaceholder: 'https://example.com',
          toggleEnabled: '启用',
          optionShow: '显示',
          optionHide: '隐藏',
          repoOwner: '仓库所有者',
          repoName: '仓库名称',
          repoBranch: '分支（可选）',
          repoOwnerPrefix: '@',
          repoNamePrefix: 'repo：',
          repoBranchPrefix: '分支：',
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
            summaryTextFilesTitle: '内容文件',
            summarySystemFilesTitle: '系统文件',
            summarySeoFilesTitle: 'SEO 文件',
            summaryAssetFilesTitle: '资源文件',
            summaryEmpty: '没有待提交的文件。',
            tokenLabel: '精细化个人访问令牌',
            helpHtml: '请在 <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">github.com/settings/tokens</a> 创建一个具有仓库内容访问权限的令牌。该令牌仅在当前浏览器会话中存储。',
            forget: '忘记令牌',
            submit: '提交更改',
            errorRequired: '请输入精细化个人访问令牌以继续。'
          },
          preview: {
            subtitle: '上传至 GitHub 之前预览待提交的文件。',
            unavailable: '无法预览此文件。',
            untitled: '未命名文件'
          }
        },
        dialogs: {
          cancel: '取消',
          confirm: '确认',
          close: '关闭'
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
  }

export default translations;
