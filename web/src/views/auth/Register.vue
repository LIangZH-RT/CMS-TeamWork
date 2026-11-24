<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '@/stores/auth'
import { explain } from '@/utils/errors'

const router = useRouter()
const auth = useAuth()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

onMounted(() => { auth.fetchCsrf().catch(() => {}) })

async function submit() {
  loading.value = true
  try {
    const user = await auth.register({ username: form.username, password: form.password })
    ElMessage.success(`已注册 ${user.username}，请登录`)
    router.push({ name: 'login' })
  } catch (e) {
    ElMessage.error(explain(e, '注册失败'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth">
    <section class="card">
      <router-link to="/login" class="back">← 返回登录</router-link>
      <h1>注册内容编辑</h1>
      <p class="lead">测试环境可直接注册编辑账号，注册后立即启用，但不会自动登录。不能通过注册成为管理员。</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="登录名">
          <el-input v-model="form.username" autocomplete="username" placeholder="字母、数字或下划线" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password autocomplete="new-password" placeholder="8～64 个字符" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">注册</el-button>
      </el-form>
    </section>
  </main>
</template>

<style scoped>
.auth { min-height: 100vh; display: grid; place-items: center; padding: 32px 16px; background: var(--paper); }
.card { width: min(440px, 100%); background: #fff; border: 1px solid var(--card-line); border-radius: 16px; padding: 28px; }
.back { font-size: 13px; color: var(--muted); }
h1 { font-family: var(--serif); margin: 12px 0 8px; }
.lead { color: var(--ink-2); font-size: 14px; line-height: 1.6; margin-bottom: 18px; }
</style>
