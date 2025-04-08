/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**', // 모든 경로 허용
      },
      // 다른 외부 이미지 호스트가 있다면 여기에 추가
    ],
  },
};

module.exports = nextConfig; 