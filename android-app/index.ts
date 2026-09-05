// react-native-gesture-handler must be the very first import in the app's
// true entry point (not App.tsx) so its native event listeners are
// installed before anything else touches the bridge.
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
