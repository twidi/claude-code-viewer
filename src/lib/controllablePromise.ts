export type ControllablePromise<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  status: "pending" | "resolved" | "rejected";
};

export const controllablePromise = <T>(): ControllablePromise<T> => {
  let promiseResolve: ((value: T) => void) | undefined;
  let promiseReject: ((reason?: unknown) => void) | undefined;

  const promiseRef = {
    status: "pending",
  } as ControllablePromise<T>;

  const promise = new Promise<T>((resolve, reject) => {
    promiseResolve = (value) => {
      promiseRef.status = "resolved";
      resolve(value);
    };
    promiseReject = (reason) => {
      promiseRef.status = "rejected";
      reject(reason);
    };
  });

  if (!promiseResolve || !promiseReject) {
    throw new Error("Illegal state: Promise not created");
  }

  // Attach a no-op catch handler to prevent unhandled rejection warnings
  // when the promise is rejected before anyone awaits it.
  // The actual error handling happens when the consumer awaits the promise.
  promise.catch(() => {});

  promiseRef.promise = promise;
  promiseRef.resolve = promiseResolve;
  promiseRef.reject = promiseReject;

  return promiseRef;
};
