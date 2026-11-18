import {useId,type ReactNode} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '../ui/dialog';
export function AdminDialog({title,description,children,headerActions,onClose,busy=false,wide=false}:{title:string;description?:string;children:ReactNode;headerActions?:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean}) {
 const descriptionId=useId();
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent aria-describedby={description?descriptionId:undefined}
 className={`max-h-[90dvh] overflow-y-auto rounded-2xl ${wide?'sm:max-w-3xl':'sm:max-w-xl'} ${headerActions?'[&>button]:top-8':''} ${busy?'[&>button]:hidden':''}`}
 onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onPointerDownOutside={event=>{if(busy)event.preventDefault();}}>
 {headerActions?<div className="flex items-center gap-2 pr-8"><DialogTitle className="min-w-0 flex-1 text-xl font-bold text-slate-900">{title}</DialogTitle>{headerActions}</div>:<DialogTitle className="pr-6 text-xl font-bold text-slate-900">{title}</DialogTitle>}{description&&<DialogDescription id={descriptionId}>{description}</DialogDescription>}{children}</DialogContent></Dialog>;
}
