import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * 全局错误边界。
 *
 * <p>React 渲染阶段出现未捕获异常时，错误边界会展示兜底页并输出控制台日志，
 * 避免用户只看到空白页面。接口错误仍由各页面的 ErrorMessage 局部展示。</p>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled frontend error", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-screen place-items-center bg-[#f7fbf8] p-6 text-slate-900">
        <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-rose-700">页面运行异常</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-950">前端页面遇到未处理错误</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            可以先刷新页面恢复使用；如果反复出现，请保留浏览器控制台错误信息用于定位。
          </p>
          <pre className="mt-4 max-h-44 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {this.state.error.message}
          </pre>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </section>
      </main>
    );
  }
}
