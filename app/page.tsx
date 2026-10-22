import { HostedOfficeView, OfficeView, isHostedDeployment } from "@/features/office-activity";

// 같은 코드가 두 곳에서 돈다. 내 PC의 로컬 서버는 PC의 상태를 바로 보여주고,
// Vercel의 호스팅은 토큰을 받아 호스팅에 올라온 상태를 보여준다.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
      {isHostedDeployment() ? <HostedOfficeView /> : <OfficeView />}
    </main>
  );
}
