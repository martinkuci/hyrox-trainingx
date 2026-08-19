import Image from "next/image";

type BrandAssetProps = {
  className?: string;
  priority?: boolean;
};

export function EnginnMark({ className = "size-10", priority = false }: BrandAssetProps) {
  return (
    <Image
      src="/brand/enginn-app-icon.svg"
      alt=""
      width={512}
      height={512}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}

export function EnginnWordmark({ className = "h-5 w-auto", priority = false }: BrandAssetProps) {
  return (
    <Image
      src="/brand/enginn-wordmark.svg"
      alt=""
      width={560}
      height={128}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
