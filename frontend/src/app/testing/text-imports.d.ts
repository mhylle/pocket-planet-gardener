/** A stylesheet imported as its text with the loader: 'text' import attribute, in specs. */
declare module '*.scss' {
  const text: string;
  export default text;
}
