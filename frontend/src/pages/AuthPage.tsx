import { useMutation } from "@tanstack/react-query";
import { BookOpen, LogIn, Sprout } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, ErrorMessage, Field, Input } from "../components/ui";
import { api } from "../lib/api";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      isRegister
        ? api.register({ email, displayName, password })
        : api.login({ email, password }),
    onSuccess: () => navigate("/app/knowledge-bases", { replace: true })
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <main className="min-h-screen bg-[#f5faf7] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-600 text-white">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">RAG Knowledge Base</p>
              <p className="text-xs text-slate-500">知识库增强问答工作台</p>
            </div>
          </div>

          <div className="my-12 max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700">
              <BookOpen className="h-3.5 w-3.5" />
              文档、检索、问答集中管理
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl">
              为不同业务创建专属知识库
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600">
              上传业务文档，自动切分入库，通过向量检索和混合检索构建可追溯的 RAG 问答流程。
            </p>
          </div>

          <div className="hidden grid-cols-3 gap-3 text-sm text-slate-600 sm:grid">
            <div className="rounded-lg border border-emerald-100 bg-white/80 p-4">知识库隔离</div>
            <div className="rounded-lg border border-cyan-100 bg-white/80 p-4">引用可追踪</div>
            <div className="rounded-lg border border-slate-100 bg-white/80 p-4">任务可观察</div>
          </div>
        </section>

        <section className="flex items-center px-6 py-8 sm:px-10">
          <form onSubmit={submit} className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <LogIn className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-slate-950">{isRegister ? "创建账号" : "登录工作台"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isRegister ? "注册后即可创建第一个业务知识库。" : "继续管理知识库、文档和问答会话。"}
              </p>
            </div>

            <div className="space-y-4">
              {isRegister ? (
                <Field label="显示名称">
                  <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：产品运营" required />
                </Field>
              ) : null}
              <Field label="邮箱">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" required />
              </Field>
              <Field label="密码">
                <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="至少输入一个可用密码" required />
              </Field>
              <ErrorMessage error={mutation.error} />
              <Button className="w-full" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "提交中..." : isRegister ? "注册并进入" : "登录"}
              </Button>
            </div>

            <p className="mt-5 text-center text-sm text-slate-500">
              {isRegister ? "已有账号？" : "还没有账号？"}
              <Link className="ml-1 font-medium text-emerald-700 hover:text-emerald-800" to={isRegister ? "/login" : "/register"}>
                {isRegister ? "去登录" : "去注册"}
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
