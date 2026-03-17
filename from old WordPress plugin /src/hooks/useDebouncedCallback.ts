import { useEffect, useRef, useCallback } from 'react';

export function useDebouncedCallback<A extends any[]>(
    callback: (...args: A) => void,
    wait: number
): [((...args: A) => void), () => void] {
    const argsRef = useRef<A>();
    const timeout = useRef<ReturnType<typeof setTimeout>>();

    const cleanup = useCallback(() => {
        if(timeout.current) {
            clearTimeout(timeout.current);
        }
    }, []);

    useEffect(() => cleanup, [cleanup]);

    const debouncedCallback = useCallback((...args: A) => {
        argsRef.current = args;
        
        cleanup();

        timeout.current = setTimeout(() => {
            if(argsRef.current) {
                callback(...argsRef.current);
            }
        }, wait);
    }, [callback, wait, cleanup]);

    return [debouncedCallback, cleanup];
}
