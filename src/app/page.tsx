'use client';

import dynamic from 'next/dynamic';

const ChatInterface = dynamic(() => import('@/components/ChatInterface'), {
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#efeae2]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#075e54]"></div>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="h-screen max-w-3xl mx-auto bg-[#efeae2] shadow-xl">
      <ChatInterface />
    </main>
  );
}
