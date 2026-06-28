import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { RoleProvider } from "~/lib/role";
import stylesheet from "~/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#fbf7f0" />
        <title>童绘 · AI 绘本教育平台</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <Outlet />
    </RoleProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : "出错了";
  const detail =
    isRouteErrorResponse(error)
      ? error.data
      : error instanceof Error
        ? error.message
        : "未知错误";
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-strong rounded-4xl p-10 max-w-lg text-center">
        <div className="text-6xl mb-4">🧸</div>
        <h1 className="text-2xl font-bold text-ink mb-2">{title}</h1>
        <p className="text-ink-muted">{String(detail)}</p>
        <a
          href="/"
          className="inline-block mt-6 rounded-full bg-brand-500 text-white px-6 py-3 font-semibold shadow-glow"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
