import { NextResponse } from 'next/server';
import createTTSService from '@/mastra/services/tts';

export async function GET() {
  try {
    const tts = createTTSService();
    const voices = await tts.getVoices();
    
    return NextResponse.json({ voices });
  } catch (error) {
    console.error('Error fetching voices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voices' },
      { status: 500 }
    );
  }
}
