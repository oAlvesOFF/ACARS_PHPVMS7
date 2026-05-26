<?php

namespace Modules\CloudeAcars\Providers;

use Illuminate\Support\ServiceProvider;

class CloudeAcarsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->registerConfig();
        $this->registerViews();
        $this->loadMigrationsFrom(__DIR__ . '/../Database/migrations');
        $this->loadRoutesFrom(__DIR__ . '/../Routes/api.php');
        $this->loadRoutesFrom(__DIR__ . '/../Routes/web.php');
    }

    public function register(): void
    {
        $this->app->register(EventServiceProvider::class);
    }

    protected function registerConfig(): void
    {
        $this->publishes([
            __DIR__ . '/../Config/config.php' => config_path('cloudeacars.php'),
        ], 'config');
        $this->mergeConfigFrom(
            __DIR__ . '/../Config/config.php', 'cloudeacars'
        );
    }

    public function registerViews(): void
    {
        $viewPath = resource_path('views/modules/cloudeacars');
        $sourcePath = __DIR__ . '/../Resources/views';

        $this->publishes([
            $sourcePath => $viewPath
        ], 'views');

        $this->loadViewsFrom(array_merge(array_map(function ($path) {
            return $path . '/modules/cloudeacars';
        }, \Config::get('view.paths')), [$sourcePath]), 'cloudeacars');
    }
}
