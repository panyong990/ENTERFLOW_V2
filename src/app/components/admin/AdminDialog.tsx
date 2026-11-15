import {useId,type ReactNode} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '../ui/dialog';
export function AdminDialog({title,description,children,onClose,busy=false,wide=false}:{title:string;description?:string;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean}) {
 const descriptionId=useId();
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent aria-describedby={description?descriptionId:undefined}
 className={`max-h-[90dvh] overflow-y-auto rounded-2xl ${wide?'sm:max-w-3xl':'sm:max-w-xl'} ${busy?'[&>button]:hidden':''}`}
 onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onPointerDownOutside={event=>{if(busy)event.preventDefault();}}>
 <DialogTitle className="pr-6 text-xl font-bold text-slate-900">{title}</DialogTitle>{description&&<DialogDescription id={descriptionId}>{description}</DialogDescription>}{children}</DialogContent></Dialog>;
}
