import DefaultTheme from 'vitepress/theme'
import HeatTreeDemo from '../components/HeatTreeDemo.vue'
import HeroWithWidget from '../components/HeroWithWidget.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app, router, siteData }) {
    app.component('HeatTreeDemo', HeatTreeDemo)
    app.component('HeroWithWidget', HeroWithWidget)
  }
}
