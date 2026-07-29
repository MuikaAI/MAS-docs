import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Muika-After-Story",
  description: "打破第四面墙的 AI 伴侣 — 文档站",
  head: [
    ['link', { rel: 'icon', href: '/favicon.png' }],       // 站点图标
  ],
  lastUpdated: true,

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/favicon.png',

    nav: [
      { text: '首页', link: '/' },
      { text: '使用指南', link: '/guide/introduction' },
      { text: '开发指南', link: '/develop/architecture' },
      { text: '关于', link: '/about/' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '使用指南',
          items: [
            { text: '项目介绍', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '配置参考', link: '/guide/configuration' },
            { text: '模型配置', link: '/guide/model' },
            { text: '命令参考', link: '/guide/commands' },
            { text: '人设定制', link: '/guide/persona' },
            { text: '技能系统', link: '/guide/skills' },
            { text: '话题系统', link: '/guide/topics' },
            { text: '疑难解答', link: '/guide/faq' }
          ]
        }
      ],

      '/develop/': [
        {
          text: '开发指南',
          items: [
            { text: '架构概览', link: '/develop/architecture' },
            { text: '插件开发', link: '/develop/plugin-dev' },
            { text: '命令开发', link: '/develop/command-dev' },
            { text: '工具开发', link: '/develop/func-call-dev' },
            { text: '记忆系统', link: '/develop/memory-system' },
            { text: 'IPC 协议', link: '/develop/ipc' },
            { text: 'API 参考', link: '/develop/api' }
          ]
        }
      ],

      '/about/': [
        {
          text: '关于',
          items: [
            { text: '关于 Muika', link: '/about/' },
            { text: '许可证', link: '/about/license' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Moemu/Muika-After-Story' }
    ],

    search: {
      provider: 'local'
    }
  }
})
