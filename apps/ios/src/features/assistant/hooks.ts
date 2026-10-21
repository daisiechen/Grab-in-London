import {useCallback,useRef,useSyncExternalStore} from 'react';
import {useFocusEffect} from 'expo-router';
import {useServices} from '../../services.tsx';
import type {AIContext,Editor} from './manager.ts';
export function useAssistantState(){const {assistant}=useServices();return useSyncExternalStore(assistant.subscribe,assistant.getSnapshot);}
export function useAssistantContext(context:AIContext){
 const {assistant}=useServices();const encoded=JSON.stringify(context);
 useFocusEffect(useCallback(()=>assistant.setContext(JSON.parse(encoded) as AIContext),[assistant,encoded]));
}
export function useAssistantEditor(editor:Editor){
 const {assistant}=useServices();const latest=useRef(editor);latest.current=editor;
 const signature=`${editor.key}:${editor.kind}:${editor.targetId}`;
 useFocusEffect(useCallback(()=>assistant.registerEditor({key:editor.key,kind:editor.kind,targetId:editor.targetId,current:()=>latest.current.current(),apply:d=>latest.current.apply(d)}),[assistant,signature,editor.key,editor.kind,editor.targetId]));
}
