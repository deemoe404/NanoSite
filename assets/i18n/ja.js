export const languageMeta = { label: '日本語' };

const translations = {
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
      resetLanguage: '言語をリセット'
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
        editor: 'エディター',
        updates: 'システム更新'
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
      systemUpdates: {
        tabLabel: 'システム更新',
        title: 'システム更新',
        openDownload: 'リリース ZIP をダウンロード',
        downloadAssetLink: ({ name }) => `${name} をダウンロード`,
        openReleasePage: 'GitHub でリリースを開く',
        selectArchive: 'ダウンロードした ZIP を選択',
        filesHeading: '更新待ちのシステムファイル',
        releaseNotes: 'リリースノート',
        noNotes: 'このリリースには追加の説明がありません。',
        latestLabel: ({ name, tag }) => `最新リリース：${name}${tag ? `（${tag}）` : ''}`,
        publishedLabel: ({ date }) => `公開日：${date}`,
        assetLabel: ({ name, size }) => `アセット：${name}（${size}）`,
        assetWithHash: ({ name, size, hash }) => `アセット：${name}（${size}） — SHA-256 ${hash}`,
        noAsset: 'このリリースにはダウンロード可能なアセットがありません。',
        status: {
          idle: '最新のリリース ZIP をダウンロードしてから、更新を確認するために選択してください。',
          reading: 'アーカイブを読み込み中…',
          verifying: 'アーカイブを検証しています…',
          noChanges: 'システムファイルは最新です。',
          comparing: 'ダウンロードしたファイルを比較しています…',
          changes: ({ count }) => `更新が必要なシステムファイルが ${count} 件あります。`
        },
        errors: {
          releaseFetch: '最新リリース情報を取得できませんでした。',
          emptyFile: '選択したファイルは空です。',
          invalidArchive: '選択した ZIP を NanoSite リリースとして読み込めませんでした。',
          sizeMismatch: ({ expected, actual }) => `選択したアーカイブのサイズ（${actual}）がリリースアセット（${expected}）と一致しません。`,
          generic: 'システム更新に失敗しました。再試行してください。'
        },
        fileStatus: {
          added: '新規',
          modified: '更新済み'
        },
        summary: {
          added: '新しいシステムファイル',
          modified: '更新されたシステムファイル'
        }
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
          confirm: '確認',
          close: '閉じる'
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
          linkLabelTitle: 'ラベル',
          linkLabelPlaceholder: 'ラベル',
          linkHrefTitle: 'URL',
          linkHrefPlaceholder: 'https://example.com',
          toggleEnabled: '有効にする',
          optionShow: '表示する',
          optionHide: '非表示にする',
          repoOwner: 'リポジトリ所有者',
          repoName: 'リポジトリ名',
          repoBranch: 'ブランチ（任意）',
          repoOwnerPrefix: '@',
          repoNamePrefix: 'repo：',
          repoBranchPrefix: 'ブランチ：',
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
            summaryTextFilesTitle: 'コンテンツファイル',
            summarySystemFilesTitle: 'システムファイル',
            summarySeoFilesTitle: 'SEO ファイル',
            summaryAssetFilesTitle: 'アセットファイル',
            summaryEmpty: 'コミット予定のファイルはありません。',
            tokenLabel: 'ファイングレインド Personal Access Token',
            helpHtml: '<a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener">github.com/settings/tokens</a> でリポジトリ内容にアクセスできるトークンを作成してください。このトークンはこのブラウザセッションにのみ保存されます。',
            forget: 'トークンを削除',
            submit: '変更をコミット',
            errorRequired: '続行するにはファイングレインド Personal Access Token を入力してください。'
          },
          preview: {
            subtitle: 'GitHub にアップロードする前にファイルを確認できます。',
            unavailable: 'このファイルはプレビューできません。',
            untitled: '無題のファイル'
          }
        },
        dialogs: {
          cancel: 'キャンセル',
          confirm: '確認',
          close: '閉じる'
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

export default translations;
