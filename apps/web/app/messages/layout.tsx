import type {ReactNode} from 'react';
import {ChatAudioMiniBar} from './ChatAudioMiniBar';
export default function MessagesLayout({children}:{children:ReactNode}){
 return <><ChatAudioMiniBar/>{children}</>;
}
