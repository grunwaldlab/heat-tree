import DefaultTheme from 'vitepress/theme'
import HeatTreeWidget from '../components/HeatTreeWidget.vue'
import HeroWithWidget from '../components/HeroWithWidget.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router, siteData }) {
    app.component('HeatTreeWidget', HeatTreeWidget)
    app.component('HeroWithWidget', HeroWithWidget)
  }
}
