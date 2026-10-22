import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 폴더에서 서버를 둘 띄울 때(예: 로컬 화면과 호스팅 모드 시험) 서로의 빌드 폴더를 건드리지 않도록 정할 수 있다.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
