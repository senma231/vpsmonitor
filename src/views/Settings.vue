<template>
  <div class="settings">
    <a-card title="系统设置" :bordered="false">
      <a-tabs default-active-key="general">
        <a-tab-pane key="general" title="常规设置">
          <a-form :model="generalSettings" layout="vertical">
            <a-form-item label="监控间隔">
              <a-select v-model="generalSettings.monitorInterval">
                <a-option :value="30">30秒</a-option>
                <a-option :value="60">1分钟</a-option>
                <a-option :value="300">5分钟</a-option>
                <a-option :value="600">10分钟</a-option>
              </a-select>
            </a-form-item>
            
            <a-form-item label="数据保留天数">
              <a-input-number
                v-model="generalSettings.dataRetentionDays"
                :min="1"
                :max="365"
                suffix="天"
              />
            </a-form-item>
            
            <a-form-item label="启用告警">
              <a-switch v-model="generalSettings.enableAlerts" />
            </a-form-item>
          </a-form>
        </a-tab-pane>
        
        <a-tab-pane key="alerts" title="告警设置">
          <a-form :model="alertSettings" layout="vertical">
            <a-form-item label="CPU告警阈值">
              <a-input-number
                v-model="alertSettings.cpuThreshold"
                :min="1"
                :max="100"
                suffix="%"
              />
            </a-form-item>
            
            <a-form-item label="内存告警阈值">
              <a-input-number
                v-model="alertSettings.memoryThreshold"
                :min="1"
                :max="100"
                suffix="%"
              />
            </a-form-item>
            
            <a-form-item label="磁盘告警阈值">
              <a-input-number
                v-model="alertSettings.diskThreshold"
                :min="1"
                :max="100"
                suffix="%"
              />
            </a-form-item>
          </a-form>
        </a-tab-pane>
        
        <a-tab-pane key="about" title="关于">
          <a-descriptions :column="1">
            <a-descriptions-item label="系统名称">
              VPS Monitor
            </a-descriptions-item>
            <a-descriptions-item label="版本">
              v1.0.0
            </a-descriptions-item>
            <a-descriptions-item label="部署环境">
              Cloudflare Pages + Workers
            </a-descriptions-item>
            <a-descriptions-item label="数据库">
              Cloudflare D1
            </a-descriptions-item>
            <a-descriptions-item label="开源地址">
              <a href="https://github.com/senma231/vpsmonitor" target="_blank">
                GitHub
              </a>
            </a-descriptions-item>
          </a-descriptions>
        </a-tab-pane>
      </a-tabs>
      
      <div style="margin-top: 24px;">
        <a-space>
          <a-button type="primary" @click="saveSettings">
            保存设置
          </a-button>
          <a-button @click="resetSettings">
            重置
          </a-button>
        </a-space>
      </div>
    </a-card>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'Settings',
  setup() {
    const generalSettings = ref({
      monitorInterval: 60,
      dataRetentionDays: 30,
      enableAlerts: true
    })
    
    const alertSettings = ref({
      cpuThreshold: 80,
      memoryThreshold: 85,
      diskThreshold: 90
    })
    
    const saveSettings = () => {
      console.log('Saving settings:', {
        general: generalSettings.value,
        alerts: alertSettings.value
      })
      
      // 这里可以调用API保存设置
      window.$notification?.success({
        title: '保存成功',
        content: '设置已保存'
      })
    }
    
    const resetSettings = () => {
      generalSettings.value = {
        monitorInterval: 60,
        dataRetentionDays: 30,
        enableAlerts: true
      }
      
      alertSettings.value = {
        cpuThreshold: 80,
        memoryThreshold: 85,
        diskThreshold: 90
      }
      
      window.$notification?.info({
        title: '重置完成',
        content: '设置已重置为默认值'
      })
    }
    
    return {
      generalSettings,
      alertSettings,
      saveSettings,
      resetSettings
    }
  }
}
</script>

<style scoped>
.settings {
  padding: 24px;
}
</style>
