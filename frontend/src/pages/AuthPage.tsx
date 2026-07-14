import { useMutation } from "@tanstack/react-query";
import { BookOpen, Database, FileText, MessageSquare, Sprout } from "lucide-react";
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
    <main className="min-h-screen max-w-full overflow-x-hidden bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10">
        <section className="flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-900/10">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-950">RAG Knowledge Base</p>
              <p className="text-xs text-slate-500">企业知识库与 RAG 问答平台</p>
            </div>
          </div>

          <div className="mt-10 max-w-xl sm:mt-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700">
              <BookOpen className="h-3.5 w-3.5" />
              面向业务文档的 RAG 工作台
            </div>
            <h1 className="text-3xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-4xl">
              把业务文档变成可追溯的问答能力
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              按知识库组织资料，完成上传、解析、检索和带引用来源的问答，让每个业务场景都有自己的知识底座。
            </p>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-white/80 px-4 py-3">
              <Database className="h-4 w-4 text-emerald-700" />
              知识库隔离不同业务场景
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-cyan-100 bg-white/80 px-4 py-3">
              <FileText className="h-4 w-4 text-cyan-700" />
              文档自动解析并生成检索索引
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white/80 px-4 py-3">
              <MessageSquare className="h-4 w-4 text-slate-600" />
              回答附带引用来源，便于核验
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <form onSubmit={submit} className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-8">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-950">{isRegister ? "创建工作台账号" : "欢迎回来"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isRegister ? "注册后进入工作台，管理员授权后即可使用对应知识库。" : "登录后继续使用知识库问答，或维护你负责的知识库。"}
              </p>
            </div>

            <div className="space-y-4">
              {isRegister ? (
                <Field label="显示名称">
                  <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：产品运营" required maxLength={120} />
                </Field>
              ) : null}
              <Field label="邮箱">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" required />
              </Field>
              <Field label="密码">
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="至少 8 位密码"
                  required
                  minLength={isRegister ? 8 : undefined}
                  maxLength={128}
                />
              </Field>
              <ErrorMessage error={mutation.error} />
              <Button className="w-full" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "提交中..." : isRegister ? "创建账号" : "登录"}
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
