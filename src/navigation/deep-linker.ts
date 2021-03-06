import { ComponentFactory, ComponentFactoryResolver } from '@angular/core';
import { Location } from '@angular/common';

import { App } from '../components/app/app';
import { convertToViews, DIRECTION_BACK, isNav, isTab, isTabs, NavLink, NavSegment } from './nav-util';
import { ModuleLoader } from '../util/module-loader';
import { isArray, isPresent } from '../util/util';
import { Nav } from '../components/nav/nav';
import { NavController } from './nav-controller';
import { Tab } from '../components/tabs/tab';
import { Tabs } from '../components/tabs/tabs';
import { UrlSerializer } from './url-serializer';
import { ViewController } from './view-controller';

/**
 * @name DeepLinker
 * @description
 * Deep linker handles registering and displaying specific pages based on URLs. It's used
 * underneath `NavController` so it will never have to be interacted with directly. When a new
 * page is pushed with `NavController`, the URL is updated to match the path to this page.
 *
 * Unlike traditional web apps, URLs don't dictate navigation in Ionic apps.
 * Instead, URLs help us link to specific pieces of content as a breadcrumb.
 * The current URL gets updated as we navigate, but we use the `NavController`
 * push and pop, or `NavPush` and `NavPop` to move around. This makes it much easier
 * to handle complicated nested navigation.
 *
 * We refer to our URL system as a deep link system instead of a router to encourage
 * Ionic developers to think of URLs as a breadcrumb rather than as the source of
 * truth in navigation. This encourages flexible navigation design and happy apps all
 * over the world.
 *
 *
 * @usage
 *
 * The first step to setting up deep links is to add the page that should be
 * a deep link in the `IonicPageModule.forChild` import of the page's module.
 * For our examples, this will be `MyPage`:
 *
 * ```ts
 * @NgModule({
 *   declarations: [
 *     MyPage
 *   ],
 *   imports: [
 *     IonicPageModule.forChild(MyPage)
 *   ],
 *   entryComponents: [
 *     MyPage
 *   ]
 * })
 * export class MyPageModule {}
 * ```
 *
 * Then, add the `@IonicPage` decorator to the component. The most simple usage is adding an
 * empty decorator:
 *
 * ```ts
 * @IonicPage()
 * @Component({
 *   templateUrl: 'main.html'
 * })
 * export class MyPage {}
 * ```
 *
 * This will automatically create a link to the `MyPage` component using the same name as the class,
 * `name`: `'MyPage'`. The page can now be navigated to by using this name. For example:
 *
 * ```ts
 * @Component({
 *   templateUrl: 'another-page.html'
 * })
 * export class AnotherPage {
 *   constructor(public navCtrl: NavController) {}
 *
 *   goToMyPage() {
 *     // go to the MyPage component
 *     this.navCtrl.push('MyPage');
 *   }
 * }
 * ```
 *
 * The `@IonicPage` decorator accepts a `DeepLinkMetadataType` object. This object accepts
 * the following properties: `name`, `segment`, `defaultHistory`, and `priority`. All of them
 * are optional but can be used to create complex navigation links.
 *
 *
 * ### Changing Name
 *
 * As mentioned previously, the `name` property will be set to the class name if it isn't provided.
 * Changing the name of the link is extremely simple. To change the name used to link to the
 * component, simply pass it in the decorator like so:
 *
 * ```ts
 * @IonicPage({
 *   name: 'my-page'
 * })
 * ```
 *
 * This will create a link to the `MyPage` component using the name `'my-page'`. Similar to the previous
 * example, the page can be navigated to by using the name:
 *
 * ```ts
 * goToMyPage() {
 *   // go to the MyPage component
 *   this.navCtrl.push('my-page');
 * }
 * ```
 *
 *
 * ### Setting URL Path
 *
 * The `segment` property is used to set the URL to the page. If this property isn't provided, the
 * `segment` will use the value of `name`. Since components can be loaded anywhere in the app, the
 * `segment` doesn't require a full URL path. When a page becomes the active page, the `segment` is
 * appended to the URL.
 *
 * The `segment` can be changed to anything and doesn't have to match the `name`. For example, passing
 * a value for `name` and `segment`:
 *
 * ```ts
 * @IonicPage({
 *   name: 'my-page',
 *   segment: 'some-path'
 * })
 *
 * When navigating to this page as the first page in the app, the URL will look something like:
 *
 * ```
 * http://localhost:8101/#/some-path
 * ```
 *
 * However, navigating to the page will still use the `name` like the previous examples do.
 *
 *
 * ### Dynamic Links
 *
 * The `segment` property is useful for creating dynamic links. Sometimes the URL isn't known ahead
 * of time, so it can be passed as a variable.
 *
 * Since passing data around is common practice in an app, it can be reflected in the app's URL by
 * using the `:param` syntax. For example, set the `segment` in the `@IonicPage` decorator:
 *
 * ```ts
 * @IonicPage({
 *   name: 'detail-page',
 *   segment: 'detail/:id'
 * })
 * ```
 *
 * In this case, when we `push` to a new instance of `'detail-page'`, the value of `id` will
 * in the `detailInfo` data being passed to `push` will replace `:id` in the URL.
 *
 * Important: The property needs to be something that can be converted into a string, objects
 * are not supported.
 *
 * For example, to push the `'detail-page'` in the `ListPage` component, the following code could
 * be used:
 *
 * ```ts
 * @IonicPage({
 *   name: 'list'
 * })
 * export class ListPage {
 *   constructor(public navCtrl: NavController) {}
 *
 *   pushPage(detailInfo) {
 *     // Push an `id` to the `'detail-page'`
 *     this.navCtrl.push('detail-page', {
 *       'id': detailInfo.id
 *     })
 *   }
 * }
 * ```
 *
 * If the value of `detailInfo.id` is `12`, for example, the URL would end up looking like this:
 *
 * ```
 * http://localhost:8101/#/list/detail/12
 * ```
 *
 * Since this `id` will be used to pull in the data of the specific detail page, it's Important
 * that the `id` is unique.
 *
 * Note: Even though the `name` is `detail-page`, the `segment` uses `detail/:id`, and the URL
 * will use the `segment`.
 *
 *
 * ### Default History
 *
 * Pages can be navigated to using deep links from anywhere in the app, but sometimes the app is
 * launched from a URL and the page needs to have the same history as if it were navigated to from
 * inside of the app.
 *
 * By default, the page would be navigated to as the first page in the stack with no prior history.
 * A good example is the App Store on iOS. Clicking on a URL to an application in the App Store will
 * load the details of the application with no back button, as if it were the first page ever viewed.
 *
 * The default history of any page can be set in the `defaultHistory` property. This history will only
 * be used if the history doesn't already exist, meaning if you navigate to the page the history will
 * be the pages that were navigated from.
 *
 * The `defaultHistory` property takes an array of strings. For example, setting the history of the
 * detail page to the list page where the `name` is `list`:
 *
 * ```ts
 * @IonicPage({
 *   name: 'detail-page',
 *   segment: 'detail/:id',
 *   defaultHistory: ['list']
 * })
 * ```
 *
 * In this example, if the app is launched at `http://localhost:8101/#/detail/my-detail` the displayed page
 * will be the `'detail-page'` with an id of `my-detail` and it will show a back button that goes back to
 * the `'list'` page.
 *
 * An example of an application with a set history stack is the Instagram application. Opening a link
 * to an image on Instagram will show the details for that image with a back button to the user's profile
 * page. There is no "right" way of setting the history for a page, it is up to the application.
 *
 * ### Priority
 *
 * The `priority` property is only used during preloading. By default, preloading is turned off so setting
 * this property would do nothing. Preloading eagerly loads all deep links after the application boots
 * instead of on demand as needed. To enable preloading, set `preloadModules` in the main application module
 * config to `true`:
 *
 * ```ts
 * @NgModule({
 *   declarations: [
 *     MyApp
 *   ],
 *   imports: [
 *     BrowserModule,
 *     IonicModule.forRoot(MyApp, {
 *       preloadModules: true
 *     }),
 *     HttpModule
 *   ],
 *   bootstrap: [IonicApp],
 *   entryComponents: [
 *     MyApp
 *   ]
 * })
 * export class AppModule { }
 * ```
 *
 * If preloading is turned on, it will load the modules based on the value of `priority`. The following
 * values are possible for `priority`: `"high"`, `"low"`, and `"off"`. When there is no `priority`, it
 * will be set to `"low"`.
 *
 * All deep links with their priority set to `"high"` will be loaded first. Upon completion of loading the
 * `"high"` priority modules, all deep links with a priority of `"low"` (or no priority) will be loaded. If
 * the priority is set to `"off"` the link will not be preloaded. Setting the `priority` is as simple as
 * passing it to the `@IonicPage` decorator:
 *
 * ```ts
 * @IonicPage({
 *   name: 'my-page',
 *   priority: 'high'
 * })
 * ```
 *
 * We recommend setting the `priority` to `"high"` on the pages that will be viewed first when launching
 * the application.
 *
 */
export class DeepLinker {

  /** @internal */
  _segments: NavSegment[] = [];
  /** @internal */
  _history: string[] = [];
  /** @internal */
  _indexAliasUrl: string;


  constructor(
    public _app: App,
    public _serializer: UrlSerializer,
    public _location: Location,
    public _moduleLoader: ModuleLoader,
    public _baseCfr: ComponentFactoryResolver
  ) {}

  /**
   * @internal
   */
  init() {
    // scenario 1: Initial load of all navs from the initial browser URL
    const browserUrl = normalizeUrl(this._location.path());
    console.debug(`DeepLinker, init load: ${browserUrl}`);

    // update the Path from the browser URL
    this._segments = this._serializer.parse(browserUrl);

    // remember this URL in our internal history stack
    this._historyPush(browserUrl);

    // listen for browser URL changes
    this._location.subscribe((locationChg: { url: string }) => {
      this._urlChange(normalizeUrl(locationChg.url));
    });
  }

  /**
   * The browser's location has been updated somehow.
   * @internal
   */
  _urlChange(browserUrl: string) {
    // do nothing if this url is the same as the current one
    if (!this._isCurrentUrl(browserUrl)) {

      if (this._isBackUrl(browserUrl)) {
        // scenario 2: user clicked the browser back button
        // scenario 4: user changed the browser URL to what was the back url was
        // scenario 5: user clicked a link href that was the back url
        console.debug(`DeepLinker, browser urlChange, back to: ${browserUrl}`);
        this._historyPop();

      } else {
        // scenario 3: user click forward button
        // scenario 4: user changed browser URL that wasn't the back url
        // scenario 5: user clicked a link href that wasn't the back url
        console.debug(`DeepLinker, browser urlChange, forward to: ${browserUrl}`);
        this._historyPush(browserUrl);
      }

      // get the app's root nav
      const appRootNav = <Nav>this._app.getRootNav();
      if (appRootNav) {
        if (browserUrl === '/') {
          // a url change to the index url
          if (isPresent(this._indexAliasUrl)) {
            // we already know the indexAliasUrl
            // update the url to use the know alias
            browserUrl = this._indexAliasUrl;

          } else {
            // the url change is to the root but we don't
            // already know the url used. So let's just
            // reset the root nav to its root page
            appRootNav.goToRoot({
              updateUrl: false,
              isNavRoot: true
            });
            return;
          }
        }

        // normal url
        this._segments = this._serializer.parse(browserUrl);
        this._loadNavFromPath(appRootNav);
      }
    }
  }

  /**
   * Update the deep linker using the NavController's current active view.
   * @internal
   */
  navChange(direction: string) {
    // all transitions completed
    if (direction) {
      // get the app's active nav, which is the lowest level one being viewed
      const activeNav = this._app.getActiveNav();
      if (activeNav) {

        // build up the segments of all the navs from the lowest level
        this._segments = this._pathFromNavs(activeNav);

        // build a string URL out of the Path
        const browserUrl = this._serializer.serialize(this._segments);

        // update the browser's location
        this._updateLocation(browserUrl, direction);
      }
    }
  }

  /**
   * @internal
   */
  _updateLocation(browserUrl: string, direction: string) {
    if (this._indexAliasUrl === browserUrl) {
      browserUrl = '/';
    }

    if (direction === DIRECTION_BACK && this._isBackUrl(browserUrl)) {
      // this URL is exactly the same as the back URL
      // it's safe to use the browser's location.back()
      console.debug(`DeepLinker, location.back(), url: '${browserUrl}'`);
      this._historyPop();
      this._location.back();

    } else if (!this._isCurrentUrl(browserUrl)) {
      // probably navigating forward
      console.debug(`DeepLinker, location.go('${browserUrl}')`);
      this._historyPush(browserUrl);
      this._location.go(browserUrl);
    }
  }


  getComponentFromName(componentName: string): Promise<any> {
    const link = this._serializer.getLinkFromName(componentName);
    if (link) {
      // cool, we found the right link for this component name
      return this.getNavLinkComponent(link);
    }

    // umm, idk
    return Promise.reject(`invalid link: ${componentName}`);
  }


  getNavLinkComponent(link: NavLink) {
    if (link.component) {
      // sweet, we're already got a component loaded for this link
      return Promise.resolve(link.component);
    }

    if (link.loadChildren) {
      // awesome, looks like we'll lazy load this component
      // using loadChildren as the URL to request
      return this._moduleLoader.load(link.loadChildren).then((response) => {
        link.component = response.component;
        return response.component;
      });
    }

    return Promise.reject(`invalid link component: ${link.name}`);
  }


  /**
   * @internal
   */
  resolveComponent(component: any): ComponentFactory<any> {

    let cfr = this._moduleLoader.getComponentFactoryResolver(component);
    if (!cfr) {
      cfr = this._baseCfr;
    }
    return cfr.resolveComponentFactory(component);
  }

  /**
   * @internal
   */
  createUrl(nav: any, nameOrComponent: any, data: any, prepareExternalUrl: boolean = true): string {
    // create a segment out of just the passed in name
    const segment = this._serializer.createSegmentFromName(nameOrComponent);
    if (segment) {
      const path = this._pathFromNavs(nav, segment.component, data);
      // serialize the segments into a browser URL
      // and prepare the URL with the location and return
      const url = this._serializer.serialize(path);
      return prepareExternalUrl ? this._location.prepareExternalUrl(url) : url;
    }
    return '';
  }

  /**
   * Build a browser URL out of this NavController. Climbs up the tree
   * of NavController's to create a string representation of all the
   * NavControllers state.
   *
   * @internal
   */
  _pathFromNavs(nav: NavController, component?: any, data?: any): NavSegment[] {
    const segments: NavSegment[] = [];
    let view: ViewController;
    let segment: NavSegment;
    let tabSelector: string;

    // recursivly climb up the nav ancestors
    // and set each segment's data
    while (nav) {
      // this could be an ion-nav, ion-tab or ion-portal
      // if a component and data was already passed in then use it
      // otherwise get this nav's active view controller
      if (!component && isNav(nav)) {
        view = nav.getActive(true);
        if (view) {
          component = view.component;
          data = view.data;
        }
      }

      // the ion-nav or ion-portal has an active view
      // serialize the component and its data to a NavSegment
      segment = this._serializer.serializeComponent(component, data);

      // reset the component/data
      component = data = null;

      if (!segment) {
        break;
      }

      // add the segment to the path
      segments.push(segment);

      if (isTab(nav)) {
        // this nav is a Tab, which is a child of Tabs
        // add a segment to represent which Tab is the selected one
        tabSelector = this._getTabSelector(<any>nav);
        segments.push({
          id: tabSelector,
          name: tabSelector,
          component: null,
          data: null
        });

        // a parent to Tab is a Tabs
        // we should skip over any Tabs and go to the next parent
        nav = nav.parent && nav.parent.parent;

      } else {
        // this is an ion-nav
        // climb up to the next parent
        nav = nav.parent;
      }
    }

    // segments added from bottom to top, so Ti esrever dna ti pilf
    return segments.reverse();
  }

  /**
   * @internal
   */
  _getTabSelector(tab: Tab): string {
    if (isPresent(tab.tabUrlPath)) {
      return tab.tabUrlPath;
    }
    if (isPresent(tab.tabTitle)) {
      return this._serializer.formatUrlPart(tab.tabTitle);
    }
    return `tab-${tab.index}`;
  }

  /**
   * @internal
   */
  getSelectedTabIndex(tabsNav: Tabs, pathName: string, fallbackIndex: number = 0): number {
    // we found a segment which probably represents which tab to select
    const indexMatch = pathName.match(/tab-(\d+)/);
    if (indexMatch) {
      // awesome, the segment name was something "tab-0", and
      // the numbe represents which tab to select
      return parseInt(indexMatch[1], 10);
    }

    // wasn't in the "tab-0" format so maybe it's using a word
    const tab = tabsNav._tabs.find(t => {
      return (isPresent(t.tabUrlPath) && t.tabUrlPath === pathName) ||
             (isPresent(t.tabTitle) && this._serializer.formatUrlPart(t.tabTitle) === pathName);
    });

    return isPresent(tab) ? tab.index : fallbackIndex;
  }

  /**
   * Each NavController will call this method when it initializes for
   * the first time. This allows each NavController to figure out
   * where it lives in the path and load up the correct component.
   * @internal
   */
  initNav(nav: any): NavSegment {
    const path = this._segments;

    if (nav && path.length) {
      if (!nav.parent) {
        // a nav without a parent is always the first nav segment
        path[0].navId = nav.id;
        return path[0];
      }

      for (var i = 1; i < path.length; i++) {
        if (path[i - 1].navId === nav.parent.id) {
          // this nav's parent segment is the one before this segment's index
          path[i].navId = nav.id;
          return path[i];
        }
      }
    }
    return null;
  }

  /**
   * @internal
   */
  initViews(segment: NavSegment) {
    const link = this._serializer.getLinkFromName(segment.name);
    return this.getNavLinkComponent(link).then((component: any) => {
      segment.component = component;
      const view = new ViewController(component, segment.data);
      view.id = segment.id;

      if (isArray(segment.defaultHistory)) {
        return convertToViews(this, segment.defaultHistory).then(views => {
          views.push(view);
          return views;
        });
      }

      return [view];
    });
  }

  /**
   * Using the known Path of Segments, walk down all descendents
   * from the root NavController and load each NavController according
   * to each Segment. This is usually called after a browser URL and
   * Path changes and needs to update all NavControllers to match
   * the new browser URL. Because the URL is already known, it will
   * not update the browser's URL when transitions have completed.
   *
   * @internal
   */
  _loadNavFromPath(nav: NavController, done?: Function) {
    if (!nav) {
      done && done();

    } else {
      this._loadViewFromSegment(nav, () => {
        this._loadNavFromPath(nav.getActiveChildNav(), done);
      });
    }
  }

  /**
   * @internal
   */
  _loadViewFromSegment(navInstance: any, done: Function) {
    // load up which nav ids belong to its nav segment
    let segment = this.initNav(navInstance);
    if (!segment) {
      done();
      return;
    }

    if (isTabs(navInstance)) {
      (<Tabs>navInstance).select(
        this.getSelectedTabIndex((<Tabs>navInstance), segment.name),
        {
          updateUrl: false,
          animate: false
        }
      );
      done();
      return;
    }

    let nav = <NavController>navInstance;

    // walk backwards to see if the exact view we want to show here
    // is already in the stack that we can just pop back to
    let view: ViewController;
    const count = nav.length() - 1;
    for (var i = count; i >= 0; i--) {
      view = nav.getByIndex(i);

      if (view && view.id === segment.id) {
        // hooray! we've already got a view loaded in the stack
        // matching the view they wanted to show
        if (i === count) {
          // this is the last view in the stack and it's the same
          // as the segment so there's no change needed
          done();

        } else {
          // it's not the exact view as the end
          // let's have this nav go back to this exact view
          nav.popTo(view, {
            animate: false,
            updateUrl: false,
          }, done);
        }
        return;
      }
    }

    // ok, so they must be pushing a new view to the stack
    // since we didn't find this same component already in the stack
    nav.push(segment.component, segment.data, {
      id: segment.id, animate: false, updateUrl: false
    }, done);
  }

  /**
   * @internal
   */
  _isBackUrl(browserUrl: string) {
    return (browserUrl === this._history[this._history.length - 2]);
  }

  /**
   * @internal
   */
  _isCurrentUrl(browserUrl: string) {
    return (browserUrl === this._history[this._history.length - 1]);
  }

  /**
   * @internal
   */
  _historyPush(browserUrl: string) {
    if (!this._isCurrentUrl(browserUrl)) {
      this._history.push(browserUrl);
      if (this._history.length > 30) {
        this._history.shift();
      }
    }
  }

  /**
   * @internal
   */
  _historyPop() {
    this._history.pop();
    if (!this._history.length) {
      this._historyPush(this._location.path());
    }
  }

}


export function setupDeepLinker(app: App, serializer: UrlSerializer, location: Location, moduleLoader: ModuleLoader, cfr: ComponentFactoryResolver) {
  const deepLinker = new DeepLinker(app, serializer, location, moduleLoader, cfr);
  deepLinker.init();
  return deepLinker;
}


export function normalizeUrl(browserUrl: string): string {
  browserUrl = browserUrl.trim();
  if (browserUrl.charAt(0) !== '/') {
    // ensure first char is a /
    browserUrl = '/' + browserUrl;
  }
  if (browserUrl.length > 1 && browserUrl.charAt(browserUrl.length - 1) === '/') {
    // ensure last char is not a /
    browserUrl = browserUrl.substr(0, browserUrl.length - 1);
  }
  return browserUrl;
}
