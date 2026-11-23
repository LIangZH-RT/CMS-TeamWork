<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '@/stores/auth'
import { explain } from '@/utils/errors'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const loading = ref(false)
const form = reactive({ username: '', password: '' })
const useMock = import.meta.env.VITE_USE_MOCK === 'true'

function safeNext() {
  const raw = route.query.redirect
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/admin'
}

async function submit() {
  loading.value = true
  try {
    await auth.login({ username: form.username, password: form.password })
    ElMessage.success('已登录')
    router.replace(safeNext())
  } catch (e) {
    ElMessage.error(explain(e, '登录失败'))
  } finally {
    loading.value = false
  }
}

function fill(username, password) {
  form.username = username
  form.password = password
}
</script>

<template>
  <main class="auth">
    <section class="card">
      <router-link to="/" class="back">← 返回博客</router-link>
      <h1>作者登录</h1>
      <p class="lead">使用内容编辑或管理员账号进入后台。登录失败时不会说明是账号、密码还是已停用。</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="登录名">
          <el-input v-model="form.username" autocomplete="username" placeholder="3～32 位字母、数字或下划线" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" style="width: 100%">登录</el-button>
      </el-form>
      <p class="foot">还没有账号？<router-link to="/register">注册内容编辑</router-link></p>
      <div v-if="useMock" class="demo">
        <p>契约 mock 演示账号（密码仅用于本地模拟）：</p>
        <button type="button" @click="fill('admin', 'Admin@12345')">管理员 admin / Admin@12345</button>
        <button type="button" @click="fill('zhangsan', 'Editor@12345')">编辑 zhangsan / Editor@12345</button>
        <button type="button" @click="fill('chenba', 'Editor@12345')">无文章编辑 chenba / Editor@12345</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth { min-height: 100vh; display: grid; place-items: center; padding: 32px 16px; background: var(--paper); }
.card { width: min(440px, 100%); background: #fff; border: 1px solid var(--card-line); border-radius: 16px; padding: 28px; }
.back { font-size: 13px; color: var(--muted); }
h1 { font-family: var(--serif); margin: 12px 0 8px; }
.lead { color: var(--ink-2); font-size: 14px; line-height: 1.6; margin-bottom: 18px; }
.foot { margin-top: 16px; font-size: 14px; color: var(--ink-2); }
.foot a { color: var(--accent); }
.demo { margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--line); font-size: 13px; color: var(--muted); display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.demo button { background: none; border: 0; color: var(--accent); cursor: pointer; padding: 0; }
</style>
