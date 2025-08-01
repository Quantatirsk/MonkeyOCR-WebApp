import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

interface AnimatedProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number;
  showAnimation?: boolean;
}

const AnimatedProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  AnimatedProgressProps
>(({ className, value = 0, showAnimation = true, ...props }, ref) => {
  const [displayValue, setDisplayValue] = React.useState(value);

  // Smooth transition when value changes
  React.useEffect(() => {
    if (value !== displayValue) {
      const startValue = displayValue;
      const targetValue = value;
      const duration = 500; // 500ms transition
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (targetValue - startValue) * easeOutCubic;
        
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [value, displayValue]);

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-primary-foreground border border-border",
        className
      )}
      {...props}
    >
      {/* Main progress bar */}
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all duration-500 ease-out relative overflow-hidden"
        style={{ transform: `translateX(-${100 - displayValue}%)` }}
      >
        {/* Flowing light effect */}
        {displayValue > 0 && displayValue < 100 && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-flow" />
        )}
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
})

AnimatedProgress.displayName = "AnimatedProgress"

export { AnimatedProgress }