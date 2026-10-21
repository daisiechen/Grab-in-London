import { PrimaryLink } from '../ui/components.tsx';

export function NotFound() {
  return (
    <div className="body-pad empty">
      <h1>This page isn’t on the menu.</h1>
      <p>The link may be old or mistyped.</p>
      <PrimaryLink to="/discover">Explore meals</PrimaryLink>
    </div>
  );
}
