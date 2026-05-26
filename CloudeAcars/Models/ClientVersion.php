<?php

namespace Modules\CloudeAcars\Models;

use App\Models\Model;

class ClientVersion extends Model
{
    protected $table = 'cloudeacars_client_versions';
    protected $fillable = ['version', 'download_url', 'is_mandatory'];
}
