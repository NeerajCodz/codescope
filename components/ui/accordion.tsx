'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const Accordion = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('space-y-2', className)} {...props} />
);

const AccordionItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('rounded-lg border border-border/50', className)} {...props} />
    )
);
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ className, ...props }, ref) => (
        <button
            ref={ref}
            type="button"
            className={cn('flex w-full items-center justify-between py-2 text-sm font-medium', className)}
            {...props}
        />
    )
);
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('pt-1 pb-3 text-sm', className)} {...props} />
    )
);
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
