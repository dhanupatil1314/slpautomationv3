import * as React from "react"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md",
        "bg-muted",
        "before:absolute before:inset-0",
        "before:-translate-x-full",
        "before:animate-[shimmer_1.8s_infinite]",
        "before:bg-gradient-to-r",
        "before:from-transparent",
        "before:via-background/60",
        "before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
