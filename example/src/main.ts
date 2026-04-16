import styles from './app.module.css'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="${styles.container}">
    <h1 class="${styles.title}">CSS Module DTS Plugin</h1>
    <p class="${styles.desc}">
      悬停类名可查看 JSDoc 注释和源码跳转链接。
    </p>
    <button class="${styles.btn}">示例按钮</button>
  </div>
`
