import TestRenderer from 'react-test-renderer';

test('renders without crashing', () => {
  TestRenderer.create(<div></div>);
});