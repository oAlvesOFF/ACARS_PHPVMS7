<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateCloudeacarsClientVersions extends Migration
{
    public function up()
    {
        Schema::create('cloudeacars_client_versions', function (Blueprint $table) {
            $table->id();
            $table->string('version');
            $table->string('download_url')->nullable();
            $table->boolean('is_mandatory')->default(false);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('cloudeacars_client_versions');
    }
}
